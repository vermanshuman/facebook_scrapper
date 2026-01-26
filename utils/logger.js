const winston = require('winston');
const format = winston.format;
const Transport = require('winston-transport');
require('winston-daily-rotate-file');

class SimpleConsoleTransport extends Transport {
    log = (info, callback) => {
      setImmediate(() => this.emit("logged", info));
  
      console.log(info);
  
      if (callback) {
        callback();
      }
    };
}

class Logger {
    static #timestampFormat = format.printf(({ level, message, timestamp }) => {
        return `[${timestamp}] [${level}]: ${message}`;
    });
    static #simpleConsoleTransport = new SimpleConsoleTransport();
    static #fileTransportExceptions = new winston.transports.DailyRotateFile({
        filename: './logs/exceptions-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        format: format.combine(
            format.timestamp(),
            this.#timestampFormat,
        ),
        maxSize: '20m',
        maxFiles: '14d'
    });
    static #fileTransportErrors = new winston.transports.DailyRotateFile({
        filename: './logs/errors-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        format: format.combine(
            format.timestamp(),
            this.#timestampFormat,
        ),
        maxSize: '20m',
        maxFiles: '14d'
    });
    static #errorLogger = null;

    static getErrorLogger = () => {
        if(!this.#errorLogger){
            this.#errorLogger = winston.createLogger({
                transports: [
                    this.#fileTransportErrors,
                    this.#simpleConsoleTransport,
                ],
                exceptionHandlers: [
                    this.#fileTransportExceptions,
                    this.#simpleConsoleTransport
                ]
            });
        }
        return this.#errorLogger;
    }

    constructor(){
        
    }
}

module.exports = Logger;