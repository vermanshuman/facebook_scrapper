const { Sequelize, DataTypes, Model } = require('sequelize');

const define = (sequelize) => {

    const model = sequelize.define('FB_Profile',
    {
        // Model attributes are defined here
        id:{
            type:DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        fb_id:{
            type:DataTypes.BIGINT,
            allowNull: false,
            unique: true,
        },
        url:{
            type: DataTypes.TEXT,
        },
        profile_photo_url:{
            type: DataTypes.TEXT,
            allowNull: true,
        },
        name: {
            type: DataTypes.STRING(128),
            allowNull: false,
        },        
        email: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        phone: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        currentCity: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        hometown: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        gender:{
            type:DataTypes.BOOLEAN,
            allowNull: true
        },
        isPage:{
            type:DataTypes.BOOLEAN,
            allowNull: false
        },
        website:{
            type: DataTypes.STRING(1024),
            allowNull: true,
        },
        FirmId: {
            type:DataTypes.INTEGER
        }
    },
    {
       
    }    
    );

    model.hasMany(sequelize.models.FB_Work,{onDelete: 'CASCADE'});
    sequelize.models.FB_Work.belongsTo(model);
    model.hasMany(sequelize.models.FB_Education,{onDelete: 'CASCADE'});
    sequelize.models.FB_Education.belongsTo(model);
    return model;
}

module.exports = define;