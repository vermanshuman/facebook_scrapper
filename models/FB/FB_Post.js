const { Sequelize, DataTypes, Model } = require('sequelize');

const define = (sequelize) => {

    const model = sequelize.define('FB_Post',
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
        text:{
            type:DataTypes.TEXT,
            allowNull: true
        },
        imgUrl:{
            type:DataTypes.STRING,
            allowNull: true
        },
        url:{
            type:DataTypes.STRING,
            allowNull: true
        },
        creationTime:{
            type:DataTypes.BIGINT,
            allowNull: true
        },
        reactionsCount:{
            type:DataTypes.INTEGER,
            allowNull: true
        },
        shareCount:{
            type:DataTypes.INTEGER,
            allowNull: true
        },
        FirmId: {
            type:DataTypes.INTEGER
        }
    },
    {
       
    }    
    );
    model.belongsTo(sequelize.models.FB_Profile, {foreignKey: 'authorId'});
    return model;
}

module.exports = define;