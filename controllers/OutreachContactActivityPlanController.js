const ORMController = require("./ORMController");

class OutreachContactActivityPlanController {
    #sequelize = null;

    constructor() {
        this.#sequelize = ORMController.getSequelize();
    }

    getReadyMessages = async () => {
        const Model = this.#sequelize.models.OutreachContactActivityPlan;

        return await Model.findAll({
            where: {
                activity: 'message',
                status: 'scheduled'
            },
            order: [['date', 'ASC']]
        });
    }

    markSent = async (id) => {
        const Model = this.#sequelize.models.OutreachContactActivityPlan;
        let instance = await Model.findByPk(id);
        if (!instance) return;
        instance.status = 'sent';
        await instance.save();
    }

    markError = async (id) => {
        const Model = this.#sequelize.models.OutreachContactActivityPlan;
        let instance = await Model.findByPk(id);
        if (!instance) return;
        instance.status = 'failed';
        instance.summary = 'Auto message send error';
        await instance.save();
    }
}

module.exports = OutreachContactActivityPlanController;
