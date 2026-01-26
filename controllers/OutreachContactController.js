const ORMController = require("./ORMController");

class OutreachContactController{
    #sequelize = null;

    constructor(){
        this.#sequelize = ORMController.getSequelize();        
    }

    getOCByFBID = async (fb_id) => {
        const OutreachContactModel = this.#sequelize.models.OutreachContact;
        let found = await OutreachContactModel.findOne({ where: {fb_id:fb_id}});
        return found;
    }

    saveOC = async (profile,group) => {
        const OutreachContactModel = this.#sequelize.models.OutreachContact;
        let ocInstance = await this.getOCByFBID(profile.fb_id);
        if(!ocInstance){
            ocInstance = await OutreachContactModel.build();
        }       
        let ocJSON = {        
            email: profile.email,
            phoneMobile: profile.phone,
            facebookProfileUrl: profile.url,
            fb_id: profile.fb_id,
            website: profile.website,            
        }
        if(!profile.email) ocJSON.email = ",ozo@etonmedical.co.uk";
        ocJSON[(profile.isPage) ? "companyName": "personName"] = profile.name;
        if(!!group){
            if(!!group.OutreachContactSourceId) ocJSON.OutreachContactSourceId=group.OutreachContactSourceId;
            if(!!group.OutreachContactSetId) ocJSON.OutreachContactSetId=group.OutreachContactSetId;
            if(!!group.OutreachContactCategoryId) ocJSON.OutreachContactCategoryId=group.OutreachContactCategoryId;
            if(!!group.OutreachContactClassId) ocJSON.OutreachContactClassId=group.OutreachContactClassId;
            if(!!group.IndustryId) ocJSON.IndustryId=group.IndustryId;
            if(!!group.FirmId) ocJSON.FirmId=group.FirmId;            
        }               
        await ocInstance.set(ocJSON);
        await ocInstance.save();
        if(!!group && !!group.OutreachContactGroupId){
            let [results, metadata] = await this.#sequelize.query(`INSERT INTO \`OutreachContact_OutreachContactGroup\` SET createdAt = now() , updatedAt = now() , OutreachContactId = ${ocInstance.id}, OutreachContactGroupId = ${group.OutreachContactGroupId} ON DUPLICATE KEY UPDATE OutreachContactId =  ${ocInstance.id}, OutreachContactGroupId = ${group.OutreachContactGroupId};`);
        }        
        await ocInstance.setFB_Profile(profile);
        return ocInstance;
    }
}

module.exports = OutreachContactController;