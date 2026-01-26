const ORMController = require("./ORMController");
const ProfileController = require("./ProfileController");
const CommentController = require("./CommentController");
const OutreachContactController = require("./OutreachContactController");
class PostController{
    #sequelize = null;
    #profileController = null;
    #commentController = null;
    #ocController = null;
    constructor(){
        this.#sequelize = ORMController.getSequelize();
        this.#profileController = new ProfileController();
        this.#commentController = new CommentController();
        this.#ocController = new OutreachContactController();
    }

    getPost = async (fb_id) => {
        //fb_id = parseInt(fb_id);
        const FBPostModel = this.#sequelize.models.FB_Post;
        let found = await FBPostModel.findOne({ where: {fb_id:fb_id}});
        return found;
    }

    savePost = async (FBPostInstance,scrapedPostData,group) => {
        const FBPostModel = this.#sequelize.models.FB_Post;        
        const instanceObj = {
            fb_id: scrapedPostData.post_id,
            url:scrapedPostData.post_url,
            creationTime:scrapedPostData.creation_time,
            reactionsCount:scrapedPostData.reactions_count,
            shareCount:scrapedPostData.share_count
        }
        if(!!group && !!group.FirmId) instanceObj.FirmId = group.FirmId;
        if(!!scrapedPostData.content_text) instanceObj.text = scrapedPostData.content_text;
        if(!!scrapedPostData.image_url) instanceObj.imgUrl = scrapedPostData.image_url;
        if(!FBPostInstance){
            FBPostInstance = await FBPostModel.build();
        }
        await FBPostInstance.set(instanceObj);
        await FBPostInstance.save();
        if(!!scrapedPostData.post_owner){
            if(!!group && !!group.FirmId) scrapedPostData.post_owner.FirmId = group.FirmId;
            let profile = await this.#profileController.getProfile(scrapedPostData.post_owner.id);
            if(!profile) profile = await this.#profileController.saveProfile(scrapedPostData.post_owner);
            await FBPostInstance.setFB_Profile(profile);
            let OC = await this.#ocController.saveOC(profile,group);
            if(!!group && !!group.id){
                let [results, metadata] = await this.#sequelize.query(`INSERT INTO \`FB_Profile_FB_Group\` SET createdAt = now() , updatedAt = now() , FBProfileId = ${profile.id}, FBGroupId = ${group.id} ON DUPLICATE KEY UPDATE FBProfileId =  ${profile.id}, FBGroupId = ${group.id};`);
            }
        }

        for (let i = 0; i < scrapedPostData.comments.length; i++) {
            const commentData = scrapedPostData.comments[i];
            let comment = await this.#commentController.getComment(commentData.id);
            comment = await this.#commentController.saveComment(comment,commentData,group);
            await comment.setFB_Post(FBPostInstance);
        }

        return FBPostInstance;
    }
}

module.exports = PostController;