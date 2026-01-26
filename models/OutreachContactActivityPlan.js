const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    return sequelize.define(
        'OutreachContactActivityPlan',
        {
            id: {
                type: DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true,
            },
            ref: {
                type: DataTypes.STRING(32),
                allowNull: false,
            },
            date: {
                type: DataTypes.DATE,
                allowNull: false,
            },
            activity: {
                type: DataTypes.ENUM(
                    'message',
                    'connection_request',
                    'post',
                    'comment',
                    'follow_request'
                ),
                allowNull: false,
            },
            status: {
                type: DataTypes.ENUM(
                    'scheduled',
                    'sent',
                    'delivered',
                    'viewed',
                    'clicked',
                    'replied',
                    'accepted',
                    'received',
                    'read',
                    'completed',
                    'no_reach',
                    'voicemail_left',
                    'invalid_number',
                    'skipped',
                    'failed',
                    'cancelled'
                ),
                allowNull: false,
            },
            subject: {
                type: DataTypes.TEXT,
            },
            message: {
                type: DataTypes.TEXT,
            },
            summary: {
                type: DataTypes.TEXT,
            },
            notes: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
        },
        {
            tableName: 'OutreachContactActivityPlans',
            timestamps: true,
        }
    );
};
