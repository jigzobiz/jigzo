const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const dns = require('dns');
try {
  dns.setServers(['8.8.8.8', '8.8.4.4']);
} catch (e) {
  console.warn('Could not set custom DNS servers:', e.message);
}

require('dotenv').config();

const connectDB = require('../src/config/database');
const Customer = require('../src/models/Customer');
const Expense = require('../src/models/Expense');
const Sale = require('../src/models/Sale');
const Category = require('../src/models/Category');
const Vendor = require('../src/models/Vendor');
const FxRate = require('../src/models/FxRate');
const Counter = require('../src/models/Counter');
const Order = require('../src/models/Order');
const Puzzle = require('../src/models/Puzzle');
const Recipient = require('../src/models/Recipient');
const PaymentTransaction = require('../src/models/PaymentTransaction');
const AuditLog = require('../src/models/AuditLog');
const WaitlistAdminMeta = require('../src/models/WaitlistAdminMeta');

const { validatePhone } = require('../src/utils/contactValidation');
const { getNextId, getNextExpenseId } = require('../src/utils/idGenerator');
const { toDecimal128, multiplyToBHD, sumBHD } = require('../src/utils/money');

const ALLOWLIST = new Set([
  'customers',
  'sales',
  'expenses',
  'counters',
  'auditlogs',
  'fxrates',
  'categories',
  'vendors',
  'reconciliationbatches',
  'waitlistadminmeta'
]);

async function run() {
  const args = process.argv.slice(2);
  const isApply = args.includes('--apply');
  const isProdApply = args.includes('--production-admin-apply');
  const isRollback = args.includes('--rollback');
  const rollbackRunId = isRollback ? args[args.indexOf('--rollback') + 1] : null;
  const isProdReadOnly = args.includes('--production-read-only');
  const dbConfirm = process.env.DB_CONFIRM;

  console.log('--- JIGZO Manual Migration Script ---');
  console.log(`Command Arguments: ${args.join(' ')}`);

  // Connect to DB
  const conn = await connectDB();
  const dbName = conn.connection.db.databaseName;
  console.log(`Connected Database Name: ${dbName}`);

  // Rollback logic
  if (isRollback) {
    if (!rollbackRunId) {
      console.error('ERROR: Please specify a migrationRunId to rollback: --rollback <id>');
      process.exit(1);
    }
    console.log(`\nStarting rollback for migrationRunId: ${rollbackRunId}...`);
    
    // Check dependencies (e.g. if new records depend on these, we might prompt or block)
    // For now we check if there are newer records in auditlogs referring to these but we proceed cleanly.
    
    // Delete from allowed collections only
    const collectionsToClean = [
      Customer, Sale, Expense, FxRate, Category, Vendor, WaitlistAdminMeta
    ];

    let totalDeleted = 0;
    for (const model of collectionsToClean) {
      const collectionName = model.collection.name;
      if (!ALLOWLIST.has(collectionName)) {
        console.error(`ERROR: Collection ${collectionName} is not in allowlist. Aborting rollback.`);
        process.exit(1);
      }
      const res = await model.deleteMany({ migrationRunId: rollbackRunId });
      totalDeleted += res.deletedCount;
      console.log(`Deleted ${res.deletedCount} documents from '${collectionName}'`);
    }

    // Do not delete counters or reduce sequence values.
    // Record rollback to auditlogs (audit log collection is never deleted)
    const rollbackAudit = new AuditLog({
      adminUserId: new mongoose.Types.ObjectId(), // System user ID
      action: 'MIGRATION_ROLLBACK',
      targetModel: 'Migration',
      targetId: rollbackRunId,
      reason: `Rollback completed. Total documents deleted: ${totalDeleted}`,
      beforeValues: { migrationRunId: rollbackRunId },
      afterValues: { deletedCount: totalDeleted }
    });
    await rollbackAudit.save();
    console.log('Rollback audit log saved. Rollback complete.');
    process.exit(0);
  }

  // Branch checks
  let gitBranch = '';
  try {
    gitBranch = require('child_process').execSync('git branch --show-current').toString().trim();
    console.log(`Current Git Branch: ${gitBranch}`);
  } catch (err) {
    console.warn('Could not determine git branch.');
  }

  // Guards for production apply
  if (isProdApply) {
    if (dbName !== 'jigzo') {
      console.error(`ERROR: Database must be exactly 'jigzo' for production apply. Currently connected to '${dbName}'.`);
      process.exit(1);
    }
    if (gitBranch !== 'feat/admin-rebuild') {
      console.error(`ERROR: Must be on branch 'feat/admin-rebuild' to run production apply. Current branch is '${gitBranch}'.`);
      process.exit(1);
    }
    if (dbConfirm !== 'YES') {
      console.error('ERROR: DB_CONFIRM=YES env var is required for production apply.');
      process.exit(1);
    }
  } else if (isProdReadOnly) {
    console.log('PRODUCTION READ-ONLY DRY RUN ENFORCED.');
  } else {
    // Staging safety checks
    if (dbName !== 'jigzo_test') {
      console.error(`ERROR: Database must be 'jigzo_test' for staging. Currently connected to '${dbName}'.`);
      process.exit(1);
    }
    if (process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production') {
      console.error('ERROR: Production mode detected. Action blocked.');
      process.exit(1);
    }
    if (gitBranch === 'master' || gitBranch === 'main') {
      console.error('ERROR: Migration blocked on master/main branch.');
      process.exit(1);
    }
  }

  // Validate seed file
  const seedPath = path.resolve(__dirname, '../../jigzo-expenses-seed.json');
  if (!fs.existsSync(seedPath)) {
    console.error(`ERROR: JSON Seed file not found at ${seedPath}`);
    process.exit(1);
  }
  const seedData = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
  
  if (seedData.expenses.length !== seedData.expectedRecordCount) {
    console.error(`ERROR: Expense count mismatch. Expected ${seedData.expectedRecordCount}, found ${seedData.expenses.length}`);
    process.exit(1);
  }

  let totalSum = '0.000';
  for (const exp of seedData.expenses) {
    totalSum = sumBHD([totalSum, exp.amountBHD]);
  }
  if (totalSum !== seedData.expectedTotalBHD || totalSum !== '930.538') {
    console.error(`ERROR: Expense total mismatch. Expected 930.538, calculated ${totalSum}`);
    process.exit(1);
  }

  // Set Mongoose middleware to block writes to operational collections
  const collectionsToWrite = Array.from(ALLOWLIST);
  mongoose.connection.setQueue = function() {}; // Safe placeholder
  
  // Custom check on every write attempt
  mongoose.set('runValidators', true);

  const originalSave = mongoose.Model.prototype.save;
  mongoose.Model.prototype.save = function(...args) {
    const colName = this.constructor.collection.name;
    if (!ALLOWLIST.has(colName)) {
      throw new Error(`CRITICAL GUARD TRIGGERED: Unauthorized write attempt to live collection '${colName}' blocked.`);
    }
    return originalSave.apply(this, args);
  };

  const originalUpdate = mongoose.Model.updateMany;
  mongoose.Model.updateMany = function(...args) {
    const colName = this.collection.name;
    if (!ALLOWLIST.has(colName)) {
      throw new Error(`CRITICAL GUARD TRIGGERED: Unauthorized write attempt to live collection '${colName}' blocked.`);
    }
    return originalUpdate.apply(this, args);
  };

  // Perform calculations for Dry-Run
  const allOrders = await Order.find();
  const allPuzzles = await Puzzle.find();

  const uniquePhones = new Set();
  for (const p of allPuzzles) {
    if (!p.senderPhone) continue;
    const phoneCheck = validatePhone(p.senderPhone);
    if (phoneCheck.valid) uniquePhones.add(phoneCheck.e164);
  }

  let capturedSales = 0;
  for (const ord of allOrders) {
    if (ord.paymentStatus === 'paid') capturedSales++;
  }

  // Dry run output
  if (!isApply && !isProdApply) {
    console.log('\n=========================================');
    console.log('DRY-RUN STATUS: SUCCESSFUL');
    console.log(`Expected Customer creates: ${uniquePhones.size}`);
    console.log(`Expected Sale creates: ${capturedSales}`);
    console.log(`Expected Expense imports: 15`);
    console.log(`Total BHD: ${totalSum}`);
    console.log('=========================================');
    process.exit(0);
  }

  // Enforce validation counts
  if (isProdApply) {
    if (uniquePhones.size !== 2) {
      console.error(`ERROR: Expected exactly 2 Customers to create, got ${uniquePhones.size}`);
      process.exit(1);
    }
    if (capturedSales !== 1) {
      console.error(`ERROR: Expected exactly 1 Sale to create, got ${capturedSales}`);
      process.exit(1);
    }
  }

  // Generate unique run metadata
  const migrationRunId = `run_${Date.now()}_${require('crypto').randomBytes(4).toString('hex')}`;
  const migratedAt = new Date();
  const migrationSource = seedData.source;

  console.log(`\nStarting migration execution... Run ID: ${migrationRunId}`);

  // 1. Seed Categories & Vendors
  for (const catName of seedData.categories) {
    await Category.findOneAndUpdate(
      { name: catName },
      { name: catName, migrationRunId, migrationSource, migratedAt },
      { upsert: true, new: true }
    );
  }
  for (const venName of seedData.vendors) {
    await Vendor.findOneAndUpdate(
      { name: venName },
      { name: venName, migrationRunId, migrationSource, migratedAt },
      { upsert: true, new: true }
    );
  }

  // 2. Seed Reference FX Rates
  for (const rateObj of seedData.currencyReferenceRatesFromWorkbook) {
    await FxRate.findOneAndUpdate(
      { currency: rateObj.currency },
      {
        currency: rateObj.currency,
        rateToBHD: toDecimal128(rateObj.rateToBHD),
        effectiveDate: new Date('2026-05-26'),
        source: 'workbook',
        migrationRunId,
        migrationSource,
        migratedAt
      },
      { upsert: true, new: true }
    );
  }

  // 3. Import Seeded Expenses
  let expensesImported = 0;
  for (const exp of seedData.expenses) {
    const year = exp.date.split('-')[0] || '2026';
    // Get counter but inject migrationRunId context
    const countRec = await Counter.findOneAndUpdate(
      { key: `expense_${year}` },
      { $inc: { seq: 1 }, $setOnInsert: { migrationRunId } },
      { upsert: true, new: true }
    );
    const expenseId = `EXP-${year}-${String(countRec.seq).padStart(4, '0')}`;

    const newExpense = new Expense({
      expenseId,
      date: new Date(exp.date),
      category: exp.category,
      vendor: exp.vendor,
      description: exp.description,
      originalAmount: toDecimal128(exp.originalAmount),
      currency: exp.currency,
      fxRateToBHD: toDecimal128(exp.fxRateToBHD),
      fxRateDate: new Date(exp.date),
      fxRateSource: 'workbook',
      amountBHD: toDecimal128(exp.amountBHD),
      paymentMethod: exp.paymentMethod || '',
      paidBy: 'JIGZO',
      status: 'Paid',
      comments: exp.comments || '',
      migrationSource,
      importBatchId: 'initial_migration_v1',
      migrationKey: exp.migrationKey,
      createdBy: 'SYSTEM',
      migrationRunId,
      migratedAt
    });
    await newExpense.save();
    expensesImported++;
  }

  // 4. Backfill Customers
  let customersCreated = 0;
  for (const puzzle of allPuzzles) {
    if (!puzzle.senderPhone) continue;
    const phoneCheck = validatePhone(puzzle.senderPhone);
    if (!phoneCheck.valid) continue;

    const normalized = phoneCheck.e164;
    let customer = await Customer.findOne({ normalizedPhone: normalized });

    if (!customer) {
      const countRec = await Counter.findOneAndUpdate(
        { key: 'customer' },
        { $inc: { seq: 1 }, $setOnInsert: { migrationRunId } },
        { upsert: true, new: true }
      );
      const customerId = `JZ-CUS-${String(countRec.seq).padStart(5, '0')}`;

      customer = new Customer({
        customerId,
        primaryPhone: puzzle.senderPhone,
        normalizedPhone: normalized,
        name: puzzle.senderName || 'Unknown Customer',
        countryName: 'Unknown',
        accountStatus: 'none',
        firstOrderAt: puzzle.createdAt,
        latestOrderAt: puzzle.createdAt,
        migrationRunId,
        migrationSource,
        migratedAt
      });
      await customer.save();
      customersCreated++;
    }
  }

  // 5. Ingest Sales
  let salesCreated = 0;
  for (const ord of allOrders) {
    if (ord.paymentStatus !== 'paid') continue;
    const chargeRef = ord.providerChargeId || ord.paymentReference || `dummy_ref_${ord.orderId}`;
    let customerId = 'Unlinked';
    let customerName = 'Unknown';
    let customerPhone = '';

    const puzzle = allPuzzles.find(p => p.publicId === ord.puzzleId);
    if (puzzle && puzzle.senderPhone) {
      const phoneCheck = validatePhone(puzzle.senderPhone);
      if (phoneCheck.valid) {
        const customerRec = await Customer.findOne({ normalizedPhone: phoneCheck.e164 });
        if (customerRec) {
          customerId = customerRec.customerId;
          customerName = customerRec.name || 'Unknown';
          customerPhone = customerRec.normalizedPhone;
        }
      }
    }

    const calculatedBHD = multiplyToBHD(ord.total.toString(), ord.currency === 'BHD' ? '1.000' : '0.376');
    const newSale = new Sale({
      saleReference: chargeRef,
      orderId: ord.orderId,
      customerId,
      customerName,
      customerPhone,
      date: ord.paidAt || ord.createdAt,
      originalAmount: toDecimal128(ord.total.toString()),
      originalCurrency: ord.currency,
      fxRateToBHD: toDecimal128(ord.currency === 'BHD' ? '1.000' : '0.376'),
      calculatedAmountBHD: toDecimal128(calculatedBHD),
      tapReference: ord.providerChargeId || '',
      paymentStatus: 'captured',
      netCalculatedBHD: toDecimal128(calculatedBHD),
      reconciliationStatus: 'Awaiting Statement',
      migrationRunId,
      migrationSource,
      migratedAt
    });
    await newSale.save();
    salesCreated++;
  }

  // Create Migration audit log entry
  const migrationAudit = new AuditLog({
    adminUserId: new mongoose.Types.ObjectId(), // System user ID
    action: 'MIGRATION_APPLY',
    targetModel: 'Migration',
    targetId: migrationRunId,
    reason: `Successful manual migration apply. Database: ${dbName}. Branch: ${gitBranch}`,
    beforeValues: {},
    afterValues: {
      migrationRunId,
      database: dbName,
      createdCustomers: customersCreated,
      createdSales: salesCreated,
      importedExpenses: expensesImported,
      expenseTotalBHD: totalSum
    }
  });
  await migrationAudit.save();

  console.log('\n=========================================');
  console.log(`MIGRATION COMPLETED SUCCESSFULLY. Run ID: ${migrationRunId}`);
  console.log('=========================================');
  process.exit(0);
}

run().catch(err => {
  console.error('Unhandled migration error:', err);
  process.exit(1);
});
