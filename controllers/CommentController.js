const ORMController = require("./ORMController");
const OutreachContactController = require("./OutreachContactController");
const ProfileController = require("./ProfileController");
class CommentController{
    #sequelize = null;
    #profileController = null;
    #ocController = null;
    constructor(){
        this.#sequelize = ORMController.getSequelize();
        this.#profileController = new ProfileController();
        this.#ocController = new OutreachContactController();
    }

    getComment = async (fb_id) => {
        const FBCommentModel = this.#sequelize.models.FB_Comment;
        let found = await FBCommentModel.findOne({ where: {fb_id:fb_id}});
        return found;
    }

    saveComment = async (FBCommentInstance,scrapedCommentData,group) => {
        const FBCommentModel = this.#sequelize.models.FB_Comment;
        const instanceObj = {
            fb_id:scrapedCommentData.id,
            creationTime:scrapedCommentData.creation_time,
            reactionsCount:scrapedCommentData.reactions_count,
        }
        if(!!scrapedCommentData.text) instanceObj.text = scrapedCommentData.text;
        if(!!scrapedCommentData.img_url) instanceObj.imgUrl = scrapedCommentData.img_url;
        if(!FBCommentInstance){
            FBCommentInstance = await FBCommentModel.build();            
        }
        await FBCommentInstance.set(instanceObj);
        await FBCommentInstance.save();
        if(!!scrapedCommentData.author){
            if(!!group && !!group.FirmId) scrapedCommentData.author.FirmId = group.FirmId;
            let profile = await this.#profileController.getProfile(scrapedCommentData.author.id);
            if(!profile) profile = await this.#profileController.saveProfile(scrapedCommentData.author);
            await FBCommentInstance.setFB_Profile(profile);
            let OC = await this.#ocController.saveOC(profile,group);
            if(!!group && !!group.id){
                let [results, metadata] = await this.#sequelize.query(`INSERT INTO \`FB_Profile_FB_Group\` SET createdAt = now() , updatedAt = now() , FBProfileId = ${profile.id}, FBGroupId = ${group.id} ON DUPLICATE KEY UPDATE FBProfileId =  ${profile.id}, FBGroupId = ${group.id};`);
            }
                
        }
        return FBCommentInstance;
    }
}

module.exports = CommentController;