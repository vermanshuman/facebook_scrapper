const { Sequelize, DataTypes, Model } = require('sequelize');

const define = (sequelize) => {

    const model = sequelize.define('FB_Education',
    {
        // Model attributes are defined here
        id:{
            type:DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        name:{
            type:DataTypes.STRING,
            allowNull: false
        }
    },
    {
       
    }    
    );       

    return model;
}

module.exports = define;