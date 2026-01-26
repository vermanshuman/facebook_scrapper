const { Sequelize, DataTypes, Model } = require('sequelize');

const define = (sequelize) => {

    const model = sequelize.define('FB_Group',
    {
        // Model attributes are defined here
        id:{
            type:DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        code: {
            type: DataTypes.STRING(128),
            allowNull: false,
        },
        name: {
            type: DataTypes.STRING(128),
            allowNull: false,
        },
        groupURL: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        dayLimit: {
            type: DataTypes.INTEGER,
        },
        userName: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        password: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        OutreachContactGroupId:{
            type:DataTypes.INTEGER
        },
        OutreachContactSourceId: {
            type:DataTypes.INTEGER
        },
        OutreachContactSetId: {
            type:DataTypes.INTEGER
        },
        OutreachContactCategoryId: {
            type:DataTypes.INTEGER
        },
        OutreachContactClassId:{
            type:DataTypes.INTEGER
        },
        OutreachContactIndustryId: {
            type:DataTypes.INTEGER
        },
        FirmId: {
            type:DataTypes.INTEGER
        },
        fetchedAt: {
            type: DataTypes.DATE
        },
        postOnly:{
            type:DataTypes.BOOLEAN,
            defaultValue: 0
        }
    },
    {
        indexes:[
            {
                name:"code_unique",
                fields: ['code', 'FirmId'],
                unique: true,
            }
        ]
    }    
    );
    //model.belongsTo(sequelize.models.Firm);
    return model;
}

module.exports = define;