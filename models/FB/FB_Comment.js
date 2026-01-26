const { Sequelize, DataTypes, Model } = require('sequelize');

const define = (sequelize) => {

    const model = sequelize.define('FB_Comment',
    {
        // Model attributes are defined here
        id:{
            type:DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        fb_id:{
            type:DataTypes.STRING,
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
        creationTime:{
            type:DataTypes.BIGINT,
            allowNull: true
        },
        reactionsCount:{
            type:DataTypes.INTEGER,
            allowNull: true
        }
    },
    {
       
    }    
    );
    model.belongsTo(sequelize.models.FB_Post, {foreignKey: 'postId'});
    sequelize.models.FB_Post.hasMany(model,{foreignKey: 'postId'});
    model.belongsTo(sequelize.models.FB_Profile, {foreignKey: 'authorId'});
    sequelize.models.FB_Profile.hasMany(model,{foreignKey: 'authorId'})
    return model;
}

module.exports = define;