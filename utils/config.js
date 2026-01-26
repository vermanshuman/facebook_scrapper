const fs = require('fs');

class Config{
    static #config = null;

    static getConfig = async () => {
        if(!this.#config){
            var fileContent = fs.readFileSync("config.json","utf8");
            this.#config = JSON.parse(fileContent);
        }
        return this.#config;        
    }
}

module.exports = Config;