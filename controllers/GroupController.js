const ORMController = require("./ORMController");
const { Sequelize, Op } = require('sequelize');

class GroupController{
    #sequelize = null;

    constructor(){
        this.#sequelize = ORMController.getSequelize();        
    }

    getGroups = async (fetchedBefore = 0) => {
        const FBGroupModel = this.#sequelize.models.FB_Group;
        let now = Sequelize.fn('CURDATE');
        //let now = await this.#sequelize.query("SELECT NOW() - INTERVAL 1 DAY")
        //let groups = await FBGroupModel.findAll({where:{[Op.or]:[{fetchedAt:{[Op.lte]:Sequelize.literal(`NOW() - INTERVAL ${fetchedBefore} DAY`)}},{fetchedAt:null}]}});
        let groups = await FBGroupModel.findAll({where:{[Op.or]:[{fetchedAt:{[Op.lte]:Sequelize.fn('ADDDATE', Sequelize.fn('NOW'), -1*fetchedBefore)}},{fetchedAt:null}]}});
        return groups;
    }

    getGroupByUrl = async (group_url) => {
        const FBGroupModel = this.#sequelize.models.FB_Group;
        let group = await FBGroupModel.findOne({where: { groupURL:{[Op.like]:`%${group_url}%`} } });
        return group;
    }

    markFetchedAt = async(groupId) =>{
        const FBGroupModel = this.#sequelize.models.FB_Group;        
        let group = await FBGroupModel.findByPk(groupId);
        group.fetchedAt = Sequelize.fn("NOW");
        await group.save();
    }
}

module.exports = GroupController;