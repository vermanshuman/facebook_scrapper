const ORMController = require("./ORMController");

class ProfileController{
    #sequelize = null;

    constructor(){
        this.#sequelize = ORMController.getSequelize();
    }

    getProfile = async (fb_id) => {
        //fb_id = parseInt(fb_id);
        const FBProfileModel = this.#sequelize.models.FB_Profile;
        let found = await FBProfileModel.findOne({ where: {fb_id:fb_id}});
        return found;
    }

    saveProfile = async (scrapedProfileData) => {
        const FBProfileModel = this.#sequelize.models.FB_Profile;
        const FBWorkModel = this.#sequelize.models.FB_Work;
        const FBEducationModel = this.#sequelize.models.FB_Education;
        const instanceObj = {
            fb_id: scrapedProfileData.id,
            url:(!!scrapedProfileData.url) ? scrapedProfileData.url:' ',
            name:scrapedProfileData.name,
            isPage: false
        }
        const FBProfileInstance = await FBProfileModel.create(instanceObj);
        if(!!scrapedProfileData.FirmId) FBProfileInstance.FirmId = scrapedProfileData.FirmId;
        if(!!scrapedProfileData.details){
            if(!!scrapedProfileData.details.profile_photo_url) FBProfileInstance.profile_photo_url = scrapedProfileData.details.profile_photo_url;
            if(!!scrapedProfileData.details.email) FBProfileInstance.email = scrapedProfileData.details.email;
            if(!!scrapedProfileData.details.profile_email) FBProfileInstance.email = scrapedProfileData.details.profile_email;
            if(!!FBProfileInstance.email && typeof FBProfileInstance.email != "string" && FBProfileInstance.email.length > 0) FBProfileInstance.email = FBProfileInstance.email.join(',');
            if(!!scrapedProfileData.details.profile_phone) FBProfileInstance.phone = scrapedProfileData.details.profile_phone;
            if(!!scrapedProfileData.details.website) FBProfileInstance.website = scrapedProfileData.details.website;
            if(!!scrapedProfileData.details.current_city) FBProfileInstance.currentCity = scrapedProfileData.details.current_city[1];
            if(!!scrapedProfileData.details.hometown) FBProfileInstance.hometown = scrapedProfileData.details.hometown[1];
            if(!!scrapedProfileData.details.gender) FBProfileInstance.gender = (scrapedProfileData.details.gender.toLowerCase() == "male");
            FBProfileInstance.isPage = !!scrapedProfileData.details && !!scrapedProfileData.details.page_id;
            if(!!scrapedProfileData.gender) FBProfileInstance.gender = (scrapedProfileData.gender.toLowerCase() == "male");
            await FBProfileInstance.save();

            if(!!scrapedProfileData.details.work){
                if(!Array.isArray(scrapedProfileData.details.work)) scrapedProfileData.details.work = [scrapedProfileData.details.work,scrapedProfileData.details.work];
                for (let i = 1; i < scrapedProfileData.details.work.length; i++) {
                    const workInfo = scrapedProfileData.details.work[i];
                    const workInstance = await FBWorkModel.create({
                        name:workInfo
                    });
                    await workInstance.setFB_Profile(FBProfileInstance);
                }
            }
            
    
            if(!!scrapedProfileData.details.education){
                 if(!Array.isArray(scrapedProfileData.details.education)) scrapedProfileData.details.education = [scrapedProfileData.details.education,scrapedProfileData.details.education];
                for (let i = 1; i < scrapedProfileData.details.education.length; i++) {
                    const educationInfo = scrapedProfileData.details.education[i];
                    const educationInstance = await FBEducationModel.create({
                        name:educationInfo
                    });
                    await educationInstance.setFB_Profile(FBProfileInstance);
                }
            }
            
        }
        
        return FBProfileInstance;
    }
}

module.exports = ProfileController;