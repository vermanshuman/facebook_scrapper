const { Sequelize, DataTypes, Model } = require('sequelize');

const define = (sequelize) => {

    const model = sequelize.define('OutreachContact',
    {
        // Model attributes are defined here
        id:{
            type:DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        email: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        phoneMobile: {
            type: DataTypes.STRING(128)
        },
        timezone:{
            type: DataTypes.STRING(6),
            defaultValue:"+00:00"
        },
        dataJSON:{
            type: DataTypes.TEXT("long")
        },
        personName: {
            type: DataTypes.STRING(128)
        },
        companyName: {
            type: DataTypes.STRING(128)
        },
        description: {
            type: DataTypes.STRING(128)
        },
        facebookProfileUrl:{
            type: DataTypes.STRING(1024)
        },
        fb_id:{
            type:DataTypes.BIGINT,
            allowNull: false,
        },
        website: {
            type: DataTypes.STRING(1024)
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
        }
    },
    {
       
    }
    );
    model.belongsTo(sequelize.models.FB_Profile);
    return model;
}

module.exports = define;
