const { Sequelize } = require('sequelize');
const config = require("../utils/config");

class ORMController {
    static #sequelize = null;

    static init = async () => {
        if(!!this.#sequelize){
            console.log("Sequelize ORM has already initialized.");
            return;
        }
        let configJSON = await config.getConfig();
        let dbConfig = configJSON["database"][configJSON["env"]];
        this.#sequelize = new Sequelize(dbConfig["name"],dbConfig["username"],dbConfig["password"],{
            host:dbConfig["host"],
            dialect: dbConfig["dialect"],
            port: dbConfig["port"] || 3308,
            pool: {
            max: 5,
            min: 0,
            acquire: 30000,
            idle: 10000,
            },
        });
        try {
            await this.#sequelize.authenticate();
            console.log('Database connection has been established successfully.');
        } catch (error) {
            console.error('Unable to connect to the database:', error);
            process.exit(1);
        }
        this.#defineModels();
        //await this.#sequelize.sync({ alter: true });
    }

    static getSequelize = () => {
        if(!this.#sequelize){
            throw new Error("Sequelize must be initialized first.");
        }
        return this.#sequelize;
    }

    static #defineModels = () => {
        if(!this.#sequelize){
            throw new Error("Sequelize must be initialized first.");
        }
        //FB Models
        require("../models/FB/FB_Group")(this.#sequelize);
        require("../models/FB/FB_Work")(this.#sequelize);
        require("../models/FB/FB_Education")(this.#sequelize);
        require("../models/FB/FB_Profile")(this.#sequelize);
        require("../models/FB/FB_Post")(this.#sequelize);
        require("../models/FB/FB_Comment")(this.#sequelize);
        require("../models/OutreachContact")(this.#sequelize);
        require("../models/OutreachContactActivityPlan")(this.#sequelize);
        
    }
}

module.exports = ORMController;
