const mongoose=require('mongoose');
const schema=new mongoose.Schema({tokenHash:{type:String,required:true,unique:true,index:true,select:false},organizationId:{type:mongoose.Schema.Types.ObjectId,ref:'Organization',required:true,index:true},campaignId:{type:mongoose.Schema.Types.ObjectId,ref:'Campaign',required:true,index:true},recipientId:{type:mongoose.Schema.Types.ObjectId,ref:'CampaignRecipient',required:true,index:true},accessTokenHash:{type:String,required:true,select:false},expiresAt:{type:Date,required:true,index:true},revokedAt:{type:Date,default:null},lastSeenAt:{type:Date,default:null}},{timestamps:true,collection:'recipientsessions'});
schema.index({expiresAt:1},{expireAfterSeconds:0});
module.exports=mongoose.models.RecipientSession||mongoose.model('RecipientSession',schema);
