const Config = require("./utils/config");
const Logger = require("./utils/logger");
const FBController = require("./controllers/FBController");
const ORMController = require("./controllers/ORMController");
const PostController = require("./controllers/PostController");
const fs = require('node:fs/promises');
const GroupController = require("./controllers/GroupController");
const moment = require('moment');
const readline = require('node:readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const parseArgs = (args) => {
    let argsObj = {};
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg.slice(0, 2) === "--") {
            const longArg = arg.split("=");
            const longArgFlag = longArg[0].slice(2);
            const longArgValue = longArg.length > 1 ? longArg[1] : true;
            argsObj[longArgFlag] = longArgValue;
          }
          // flags
          else if (arg[0] === "-") {
            const flag = arg.slice(1);
            argsObj[flag] = true;            
        }
    }
    return argsObj;
}
const args = (process.argv.length > 2) ? parseArgs(process.argv.slice(2)): {headless:false};

let main = async () => {
    let config = await Config.getConfig();    
    let dbControllers = null;
    if(config.save_to_database || config.input_from_database){
        await ORMController.init();
        dbControllers = {
            PostController: new PostController(),           
        }
    }
    const post_url = await new Promise(resolve => {
        rl.question("Enter post url: ", resolve)
    })
    //const post_url = "https://www.facebook.com/groups/604041441428373/posts/1420846999747809/";
    if(!post_url || post_url.length < 25) {
        console.log(`Invalid post url!`);
        process.exit(1);
    }
    let post_url_parts = post_url.split("/");
    if(post_url_parts.length < 7){
        console.log(`Invalid post url format! Correct Format: [https://www.facebook.com/groups/XXXXXXXXXXXX/posts/XXXXXXXXXXXXX/]`);
        process.exit(1);
    }
    let group_id = post_url_parts[4];
    let post_id = post_url_parts[6];
    let group_url_parts = post_url_parts.slice(2,5);
    let group_url = group_url_parts.join("/");
    let fb_controller = new FBController(dbControllers);
    let group_controller = new GroupController();
    await fb_controller.initialize({headless:args.headless});
    if(!!config.delay_ranges){
        fb_controller.setDelayRanges(config.delay_ranges);
    }
    let credentials = config.credentials;
    await fb_controller.logout();
    let loginResult = await fb_controller.login(credentials);
    if(!loginResult){
        console.log("Login failed.");
        process.exit(1);
    }
    let group = await group_controller.getGroupByUrl(group_url);
    let post = await fb_controller.scrapeGroupPost(post_url);
    if(!post){
        console.log(`Post content is empty!`);
        process.exit(1);
    }
    console.log(`Post ID: ${post.post_id}\tPost Date: ${moment(post.creation_time).format("DD.MM.YYYY HH:mm")}`);
    //Save the post into the database
    if(!!dbControllers){
        let postInstance = await dbControllers.PostController.getPost(post.post_id);
        postInstance = await dbControllers.PostController.savePost(postInstance,post,group);
    }
    if(config.save_to_json)
        await fs.writeFile('single_post.json', JSON.stringify(post));

    await fb_controller.close();
    process.exit(0);
}

main();