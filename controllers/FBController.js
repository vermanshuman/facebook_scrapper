const puppeteer = require("puppeteer");
const Logger = require("../utils/logger");
const moment = require('moment');
const { timeout } = require("puppeteer");
var url = require('url');

class FBController {
    #browser = null;
    #urls = {};
    #fbpage = null;
    #errorLogger = null;
    #dbControllers = null;
    #device_width = 1920;
    #device_height = 1080;
    #delay_ranges={
        after_profiles:[0,0],
        after_posts:[0,0]
    }
    #user_agent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36';
    constructor(dbControllers = null){
        this.#urls = {
            "main": () => { return "https://facebook.com"},
            "group": (group_id) => {return `https://facebook.com/groups/${group_id}/?sorting_setting=CHRONOLOGICAL`},
            "group_post": (group_id,post_id) => {return `https://www.facebook.com/groups/${group_id}/posts/${post_id}/`},
            "profile_id": (profile_id) => {return `https://www.facebook.com/profile.php?id=${profile_id}`},
            "profile": (username) => {return `https://www.facebook.com/${username}`},
            "profile_id_about": (profile_id) => {return `https://www.facebook.com/profile.php?id=${profile_id}&sk=about`},
            "profile_about": (username) => {return `https://www.facebook.com/${username}/about`},
        }
        if(!!dbControllers) this.#dbControllers = dbControllers;
        this.#errorLogger = Logger.getErrorLogger();
    }

    setDelayRanges = (delayRanges) => {
        if(!!delayRanges.after_profiles && Array.isArray(delayRanges.after_profiles) && delayRanges.after_profiles.length > 1) this.#delay_ranges.after_profiles = delayRanges.after_profiles;
        if(!!delayRanges.after_posts && Array.isArray(delayRanges.after_posts) && delayRanges.after_posts.length > 1) this.#delay_ranges.after_posts = delayRanges.after_posts;
    }

    //Initialize the browser
    initialize = async (options={headless:true}) => {
        //this.#browser = await puppeteer.launch({headless:false,protocolTimeout:0,args:["--disable-notifications",`--app=${this.#urls["main"]}`], userDataDir: '/userdata/etonfbgroups'});
        this.#browser = await puppeteer.launch({devtools: true, headless:(options.headless) ? "new":false,protocolTimeout:0,args:["--disable-notifications"], userDataDir: './userdata/etonfbgroups'});
        const [fbpage] = await this.#browser.pages();
        this.#fbpage = fbpage;
        //await this.#fbpage.setViewport({width: this.#device_width, height: this.#device_height})
        await this.#fbpage.setUserAgent(this.#user_agent);
        await this.#fbpage.goto(this.#urls["main"](),{waitUntil:'load',timeout:0});
        await this.#fbpage.waitForNetworkIdle({ concurrency: 3 }).catch((err)=>{
            let errMsg = `Timed out waiting homepage networkd idle.`;
            console.log(errMsg);
            this.#errorLogger.error(errMsg);
        });
        let cookieAllowButton = await this.#fbpage.$("div[aria-label='Allow all cookies']");
        if(!!cookieAllowButton){
            await this.#fbpage.click("div[aria-label='Allow all cookies']");
        }
        /*let loggedIn = await this.isLoggedIn();
        if(!loggedIn){
            await this.login();
            loggedIn = await this.isLoggedIn();
            if (!loggedIn) this.#errorLogger.error("Credentials are incorrect.");
        }*/
    }

    close = async () => {
        await this.#browser.close();
    }

    //Check login status by finding login or logout button
    isLoggedIn = async() => {
        const promiseResult = await Promise.race([
            this.#fbpage.waitForSelector("button[name=login]", { timeout: 0, visible: true })
            .then(()=>{return false}).catch(()=>{
                let errMsg = `Timed out waiting login button.`;
                console.log(errMsg);
                this.#errorLogger.error(errMsg);
            }),
            this.#fbpage.waitForSelector("form[action='/logout.php?button_location=settings&button_name=logout']", { timeout: 0})
            .then(()=>{return true}).catch(()=>{
                let errMsg = `Timed out waiting logout form.`;
                console.log(errMsg);
                this.#errorLogger.error(errMsg);
            }),
        ]);
        return promiseResult;
    }

    //Input the credentials and try logging in
    login = async(credentials) => {
        await this.#fbpage.type('input[name=email]', credentials.email);
        await this.#fbpage.type('input[name=pass]', credentials.password);
        await this.#fbpage.keyboard.press('Enter');
        await this.#fbpage.waitForNetworkIdle({ concurrency: 3 }).catch(()=>{
                let errMsg = `Timed out waiting login network idle.`;
                console.log(errMsg);
                this.#errorLogger.error(errMsg);
            });
        let loggedIn = await this.isLoggedIn();
        if (!loggedIn) this.#errorLogger.error("Credentials are incorrect.");
        return loggedIn;
    }

    logout = async() => {
        await this.#browser.deleteCookie({name:"c_user",domain: ".facebook.com", value:""});
        await this.#fbpage.goto(this.#urls["main"](),{waitUntil:'load',timeout:0});
        //await this.#fbpage.reload();
    }

    scrapeGroupFeed = async (group) => {
        //Get the group id from the group url
        let groupLinkParts = group.groupURL.split("/");
        let groupID = groupLinkParts[4];
        let now = moment();
        //How old posts should be scraped
        let limitDate = moment().subtract(group.dayLimit, "days");
        let minPostMillis = parseInt(now.format('x'));
        let limitMillis = parseInt(limitDate.format('x'));
        console.log(`[${groupID}] Starting to scrape posts since ${limitDate.format("DD.MM.YYYY HH:mm")}`);
        let posts = [];
        let post_urls = [];
        await this.#fbpage.on('response', async response => {
            const request = await response.request();
            let postdata = await request.postData();
            postdata = (!!postdata) ? this.#postDataStringToJson(postdata):postdata;
            if((response.url().includes("facebook.com/ajax/bulk-route-definitions/"))){
                let responseText = await response.text().catch((err)=>{
                    console.log(err);
                    this.scrapeGroupFeed(group);
                    return;
                });
                let secondPartIndex = responseText.indexOf('{"payload"');
                responseText = responseText.substring(secondPartIndex).trim();
                let responseJSON = JSON.parse(responseText);
                let payloads = responseJSON.payload.payloads;
                let urls = Object.keys(payloads);
                for (let i = 0; i < urls.length; i++) {
                    const route = urls[i];
                    if(route.includes(`${groupID}/posts/`)){
                        let route_parts = route.split("/");
                        let post_id = route_parts[4];
                        let url = this.#urls["group_post"](groupID,post_id);
                        if(!post_urls.includes(url)) post_urls.push(url);
                    }
                }
            }
            if(response.url().includes("facebook.com/api/graphql/") && request.method() == "POST" && !!postdata &&
            (postdata.fb_api_req_friendly_name == "CometGroupPermalinkRootContentFeedQuery" ||
            postdata.fb_api_req_friendly_name == "GroupsCometFeedRegularStoriesPaginationQuery")){
                console.log("GraphQL Response Intercepted For Scraping Posts");
                let responseText = await response.text().catch((err)=>{console.log(err)});
                if(!responseText) return;
                let jsonParts = [];
                let startIndex = -1;
                let endIndex = 0;
                while((endIndex = responseText.indexOf('{"label":',startIndex+1)) && endIndex != -1){
                    let partText = responseText.substring(startIndex,endIndex);
                    jsonParts.push(JSON.parse(partText))
                    startIndex = endIndex;
                }
                if(startIndex!=-1){
                    let lastPartText = responseText.substring(startIndex);
                    jsonParts.push(JSON.parse(lastPartText))
                }
                if(jsonParts.length > 0){
                    let post_ids = [];
                    post_ids.push(jsonParts[0].data.node.group_feed.edges[0].node.post_id);
                    for (let i = 1; i < jsonParts.length-1; i++) {
                        const jsonPart = jsonParts[i];
                        if(!jsonPart.data.node) continue;
                        post_ids.push(jsonPart.data.node.post_id);
                    }
                    for (let i = 0; i < post_ids.length; i++) {
                        const post_id = post_ids[i];
                        let url = this.#urls["group_post"](groupID,post_id);
                        if(!post_urls.includes(url)) post_urls.push(url);
                    }
                }

            }
        });
        //Open the group page and wait until network is idle
        await this.#fbpage.goto(this.#urls["group"](groupID),{waitUntil:'load',timeout:0});
        await this.#fbpage.waitForNetworkIdle({ concurrency: 4 }).catch(()=>{
                let errMsg = `Timed out waiting group page network idle.`;
                console.log(errMsg);
                this.#errorLogger.error(errMsg);
        });
        //Find the container div that contains posts
        let feedContainers = await this.#fbpage.$$("div[role=feed]");
        if (feedContainers.length == 0){
            this.#errorLogger.error("You cannot view the feed of this group.");
            return null;
        }
        //Run until the day limit is reached
        while(minPostMillis >= limitMillis){
            //Scroll to the end of the page so more posts will load.
            await this.#fbpage.evaluate(() => {
                window.scrollTo(0, window.document.body.scrollHeight);
            });
            await this.#fbpage.waitForNetworkIdle({ concurrency: 4 }).catch(()=>{
                let errMsg = `Timed out waiting scrolldown network idle.`;
                console.log(errMsg);
                this.#errorLogger.error(errMsg);
            });
            //Get list of post elements inside the feed container
            /*let postContainers = await this.#fbpage.$$("div[role=feed] > div");
            postContainers.splice(0, 1); //First DOM element is empty so remove it.
            postContainers.splice(-3); //Last 3 DOM elements are useless so remove them.
            if(postContainers.length == posts.length) break;*/
            for (let i = 0; i < post_urls.length; i+=1) {
                //Call the function to go to post page and scrape data.
                let post_url = post_urls.shift();
                let post = await this.scrapeGroupPost(post_url,group.postOnly);
                await this.#delayRandom(this.#delay_ranges.after_posts[0]*1000,this.#delay_ranges.after_posts[1]*1000);
                if(!post) continue;
                console.log(`Post ID: ${post.post_id}\tPost Date: ${moment(post.creation_time).format("DD.MM.YYYY HH:mm")}`);
                minPostMillis = post.creation_time;
                if(minPostMillis < limitMillis) break;
                //Save the post into the database
                if(!!this.#dbControllers){
                    let postInstance = await this.#dbControllers.PostController.getPost(post.post_id);
                    postInstance = await this.#dbControllers.PostController.savePost(postInstance,post,group);
                }
                posts.push(post);
            }
            if(minPostMillis < limitMillis) break;
        }
        return posts;
    }

    scrapeGroupPost = async (post_url,postOnly=false) => {
        /*await postDOMElementHandle.scrollIntoView();
        //await postDOMElementHandle.waitForSelector("span > span > a[role=link] > span > span");
        let linkElements = await postDOMElementHandle.$$("span > span > a[role=link] > span > span");
        if(linkElements.length == 0){
            return null;
        }
        let postLinkElement = linkElements[0];
        postLinkElement = await (await postLinkElement.getProperty("parentNode")).getProperty("parentNode");
        //await postLinkElement.scrollIntoView();
        await postDOMElementHandle.$eval('span > span > a[role=link] > span > span', node => node.scrollIntoView(false));
        await postLinkElement.hover();
        let postLinkHandle = await postLinkElement.getProperty("href");
        let postLink = await postLinkHandle.jsonValue();
        */
        let postLinkParts = post_url.split("/");
        let groupID = postLinkParts[4];
        let postID = postLinkParts[6];
        const postPage = await this.#browser.newPage();
        //Temp solution for max stack size error
        await postPage.evaluateOnNewDocument(() => {
                delete Function.prototype.toString
        })
        //await postPage.setRequestInterception(true);
        //await postPage.setViewport({width: this.#device_width, height: this.#device_height})
        await postPage.setUserAgent(this.#user_agent);
        await postPage.goto(this.#urls["group_post"](groupID,postID),{waitUntil:'load'});
        /*Information related to post are inside script tags. There are a lot of scrip tags that contains some data so loop below
        searches the related script tag.*/
        let datasjsscrips =  await postPage.$$("script[data-sjs]");
        let sjsJson = null;
        for (let i = 0; i < datasjsscrips.length; i++) {
            const script = datasjsscrips[i];
            let innerText = await(await script.getProperty("innerText")).jsonValue();
            if(innerText.includes("creation_time") && innerText.includes("actors") && innerText.includes("adp_CometSinglePostDialogContentQueryRelayPreloader")){
                /*const fs = require('node:fs/promises');
                await fs.writeFile('test.txt', innerText);*/
                sjsJson = JSON.parse(innerText);
                break;
            }
        }
        if(!sjsJson){
            return null;
        }
        //For each post the required data is located in different array index. That's why the function below runs another search.
        let dataObject = this.#findDataObject(sjsJson);
        //let postOwner = sjsJson["require"]["0"]["3"]["0"]
        //this.searchJSON(sjsJson,"comment_rendering_instance_for_feed_location",[]);        
        let postOWner = dataObject["3"]["1"]["__bbox"]["result"]["data"]["node_v2"]["comet_sections"]["content"]["story"]["actors"]["0"];
        let content_text = null;
        if(!!dataObject["3"]["1"]["__bbox"]["result"]["data"]["node_v2"]["comet_sections"]["content"]["story"]["message"]){
            content_text = dataObject["3"]["1"]["__bbox"]["result"]["data"]["node_v2"]["comet_sections"]["content"]["story"]["message"]["text"];
        }
        let reactions_count = dataObject["3"]["1"]["__bbox"]["result"]["data"]["node_v2"]["comet_sections"]["feedback"]["story"]["story_ufi_container"]["story"]["feedback_context"]["feedback_target_with_context"]["comet_ufi_summary_and_actions_renderer"]["feedback"]["reaction_count"]["count"];
        let share_count = dataObject["3"]["1"]["__bbox"]["result"]["data"]["node_v2"]["comet_sections"]["feedback"]["story"]["story_ufi_container"]["story"]["feedback_context"]["feedback_target_with_context"]["comet_ufi_summary_and_actions_renderer"]["feedback"]["share_count"]["count"];
        let creation_time = dataObject["3"]["1"]["__bbox"]["result"]["data"]["node_v2"]["comet_sections"]["timestamp"]["story"]["creation_time"];
        if(!creation_time) creation_time = dataObject["3"]["1"]["__bbox"]["result"]["data"]["node_v2"]["comet_sections"]["context_layout"]["story"]["comet_sections"]["metadata"]["1"]["story"]["creation_time"];
        let commentsInfo = dataObject["3"]["1"]["__bbox"]["result"]["data"]["node_v2"]["comet_sections"]["feedback"]["story"]["story_ufi_container"]["story"]["feedback_context"]["feedback_target_with_context"]["comment_list_renderer"]["feedback"]["comment_rendering_instance_for_feed_location"];
        //When the response from comment list request returns the code below scraped data related to comments of the post.
        const comments = [];
        postPage.on('response', async response => {
            const request = await response.request();
            let postdata = await request.postData();
            postdata = (!!postdata) ? this.#postDataStringToJson(postdata):postdata;
            if(response.url().includes("facebook.com/api/graphql/") && request.method() == "POST" && !!postdata &&
            (postdata.fb_api_req_friendly_name == "CommentListComponentsRootQuery" ||
            postdata.fb_api_req_friendly_name == "CommentsListComponentsPaginationQuery")){
                console.log("GraphQL Response Intercepted For Scraping Comments");
                let responseText = await response.text();
                let splitIndex = responseText.indexOf('{"label":');
                let responseJSON = {};
                if(splitIndex != -1){
                    let part1 = responseText.substring(0,splitIndex);
                    let part2 = responseText.substring(splitIndex);
                    responseJSON = JSON.parse(part1);
                }else{
                    responseJSON = JSON.parse(responseText);
                }

                //let responseJSON = await response.json().catch((err)=>{console.log(err)});
                let commentsList = responseJSON.data.node.comment_rendering_instance_for_feed_location.comments.edges;
                for (let i = 0; i < commentsList.length; i++) {
                    const c = commentsList[i];
                    //c.node.feedback.replies_fields
                    //c.node.author.details = await this.scrapeProfile(c.node.author.url);
                    const commentObject = {
                        id:c.node.id,
                        author:c.node.author,
                        text:(!!c.node.body &&!!c.node.body.text) ? c.node.body.text : null,
                        img_url: (!!c.node.attachments.length > 0) ? c.node.attachments[0].style_type_renderer.attachment.url:null,
                        creation_time:c.node.created_time*1000,
                        reactions_count:c.node.feedback.reactors.count
                    }
                    comments.push(commentObject);
                }
            }
        });

        //If post has comments two buttons for loading all comments are clicked to trigger comment list requests.    
        if(commentsInfo.comments.total_count > 0 && !postOnly){
            await postPage.waitForNetworkIdle({ concurrency: 1 }).catch(()=>{
                let errMsg = `Timed out waiting comments network idle.`;
                console.log(errMsg);
                this.#errorLogger.error(errMsg);
            });
            //click on show all comments
            await postPage.evaluate(() => {
                //let comments = document.querySelectorAll("div[role=article]")
                //let btnCommentsIntentList = comments[0].parentElement.parentElement.parentElement.parentElement.parentElement.parentElement.parentElement.querySelector("div[role=button]")
                let btnCommentsIntentList = document.querySelector("div.html-div > div.html-div > div > div[role=button] > span[dir=auto]");
                if(!!btnCommentsIntentList) btnCommentsIntentList.click();
            });
            await postPage.evaluate(() => {
                let btnAllcomments = document.querySelectorAll("div.__fb-light-mode div[role=menu] div[role=menuitem]");
                if(!!btnAllcomments[btnAllcomments.length-1]) btnAllcomments[btnAllcomments.length-1].click();
            })
            await postPage.waitForNetworkIdle({ concurrency: 1 }).catch(()=>{
                let errMsg = `Timed out waiting all comments network idle.`;
                console.log(errMsg);
                this.#errorLogger.error(errMsg);
            });
            //click on view other comments
            await postPage.evaluate(() => {
                let comments = document.querySelectorAll("div[role=article]")
                let btnShowOthercomments = comments[0].parentElement.parentElement.parentElement.parentElement.parentElement.parentElement.querySelectorAll("div.html-div > div.html-div > div.html-div > div.html-div > div.html-div div[role=button]");
                if(btnShowOthercomments.length > 0){
                    btnShowOthercomments = btnShowOthercomments[0];
                    btnShowOthercomments.click();
                }
            });
            await postPage.waitForNetworkIdle({ concurrency: 3 }).catch(()=>{
                let errMsg = `Timed out waiting view other comments network idle.`;
                console.log(errMsg);
                this.#errorLogger.error(errMsg);
            });
        }
        await postPage.waitForNetworkIdle({ concurrency: 3 }).catch(()=>{
                let errMsg = `Timed out waiting for network idle before closing post page.`;
                console.log(errMsg);
                this.#errorLogger.error(errMsg);
            });
        await postPage.close();
        //Scrape post author profile details
        console.log(`Profile ID: ${postOWner.id}`);
        let detailed_profile_data = await this.scrapeProfile(postOWner.url);
        await this.#delayRandom(this.#delay_ranges.after_profiles[0]*1000,this.#delay_ranges.after_profiles[1]*1000);
        postOWner.details = detailed_profile_data;
        //Scrape comment authors profile details
        for (let i = 0; i < comments.length; i++) {
            const comment = comments[i];
            console.log(`Profile ID: ${comment.author.id}`);
            comment.author.details = await this.scrapeProfile(comment.author.url);
            await this.#delayRandom(this.#delay_ranges.after_profiles[0]*1000,this.#delay_ranges.after_profiles[1]*1000);
        }
        let groupPostData = {
            post_id:postID,
            post_url:post_url,
            creation_time:creation_time*1000,
            post_owner:postOWner,
            content_text:content_text,
            reactions_count:reactions_count,
            share_count:share_count,
            comments:comments
        }

        return groupPostData;
    }

    scrapeProfile = async (profile_url) => {
        let aboutUrl = null;
        let profileUrl = null;
        if(!profile_url) return null;
        let urlObj = url.parse(profile_url,true);
        if(profile_url.includes("profile.php")){
            let profileId = urlObj.query.id;
            aboutUrl = this.#urls["profile_id_about"](profileId);
            profileUrl = this.#urls["profile_id"](profileId);
        }else{
            let username = urlObj.pathname.replaceAll("/","");
            aboutUrl = this.#urls["profile_about"](username);
            profileUrl = this.#urls["profile"](username);
        }
        const profilePage = await this.#browser.newPage();
        await profilePage.setViewport({width: this.#device_width, height: this.#device_height})
        await profilePage.setUserAgent(this.#user_agent);
        const intro_card = {};
        const profileData = {};
        profilePage.on('response', async response => {
            const request = await response.request();
            let postdata = await request.postData();
            postdata = (!!postdata) ? this.#postDataStringToJson(postdata):postdata;
            //This response is for getting profile into card from profile page, not functional rigth now.
            if(response.url().includes("facebook.com/api/graphql/") && request.method() == "POST" && !!postdata &&
            (postdata.fb_api_req_friendly_name == "ProfileCometTimelineListViewRootQuery")){
                console.log("GraphQL Response Intercepted For Scraping Profile Intro");
                let responseJSON = await response.json().catch((err)=>{console.log(err)});
                let mainSections = responseJSON.data.user.profile_tile_sections.edges[0].node.profile_tile_views.nodes;
                for (let i = 0; i < mainSections.length; i++) {
                    const mainSection = mainSections[i];
                    const subSections = mainSection.view_style_renderer.view.profile_tile_items.nodes;
                    for (let j = 0; j < subSections.length; j++) {
                        const subSection = subSections[j];
                        if(!!subSection.node.__typename=="ProfileStatus"){
                            intro_card["profile_status"] = subSection.node.profile_status_text.text;
                        }else if(!!subSection.node.__typename=="TimelineContextItemWrapper"){
                            let dataName = subSection.node.timeline_context_item.timeline_context_list_item_type;
                            let value = subSection.node.timeline_context_item.renderer.context_item.title.text;
                            if(!intro_card[dataName]){
                                intro_card[dataName] = [];
                            }
                            intro_card[dataName].push(value);
                        }
                    }
                }
            }
            //This response is for getting each section in profile about page.
            if(response.url().includes("facebook.com/api/graphql/") && request.method() == "POST" && !!postdata &&
            (postdata.fb_api_req_friendly_name == "ProfileCometAboutAppSectionQuery")){
                console.log("GraphQL Response Intercepted For Scraping Profile Details");
                let responseText = await response.text().catch((err)=>{console.log(err)});
                if(!responseText) return;
                let secondPartIndex = responseText.indexOf('{"label":"ProfileCometAboutAppSectionQuery');
                responseText = responseText.substring(0,secondPartIndex);
                if(responseText.length == 0) return;
                let responseJSON = JSON.parse(responseText);
                if(!responseJSON["data"]["user"]["about_app_sections"]["nodes"]["0"]["activeCollections"]["nodes"]["0"]["style_renderer"]["profile_field_sections"]) return;
                let profileFieldSections = responseJSON["data"]["user"]["about_app_sections"]["nodes"]["0"]["activeCollections"]["nodes"]["0"]["style_renderer"]["profile_field_sections"];
                for (let i = 0; i < profileFieldSections.length; i++) {
                    const profileFieldSection = profileFieldSections[i];
                    let infoObjList = profileFieldSection["profile_fields"]["nodes"];
                    for (let j = 0; j < infoObjList.length; j++) {
                        const infoObj = infoObjList[j];
                        if(infoObj["field_type"] == "null_state") continue;

                        let data =
                        (!!infoObj["renderer"] && !!infoObj["renderer"]["field"] && !!infoObj["renderer"]["field"]["text_content"]) ?
                        infoObj["renderer"]["field"]["text_content"]["text"] : infoObj["title"]["text"];

                        if(!!profileData[infoObj["field_type"]]){
                            if(typeof profileData[infoObj["field_type"]] != "object"){
                                profileData[infoObj["field_type"]] = [profileData[infoObj["field_type"]]]
                            }
                            profileData[infoObj["field_type"]].push(data)
                        }else{
                            profileData[infoObj["field_type"]] = data;
                        }
                    }
                }
            }
        });
        //await profilePage.goto(profileUrl,{waitUntil:'load',timeout:0});
        //await this.#fbpage.waitForNetworkIdle({ concurrency: 4 });
        await profilePage.goto(aboutUrl,{waitUntil:'load',timeout:0});
        await profilePage.waitForNetworkIdle({ concurrency: 4 }).catch(()=>{
                let errMsg = `Timed out waiting profile page network idle.`;
                console.log(errMsg);
                this.#errorLogger.error(errMsg);
            });
        const profilePhotoUrl = await profilePage.evaluate(() => {
            let profilePhotoElement = document.querySelector("div[role=main] div svg > g > image");
            let profilePhotoUrl = null;
            if(!!profilePhotoElement){
                profilePhotoUrl = profilePhotoElement.href.baseVal;
            }
            return Promise.resolve(profilePhotoUrl);
        });
        profileData["profile_photo_url"] = profilePhotoUrl;
        let aboutHeader = (await profilePage.$$("div > h2[dir=auto]"))[0];
        let aboutContainer = await (await aboutHeader.getProperty('parentElement')).getProperty('parentElement');
        let profileAboutCategoryLinkHandles = await aboutContainer.$$("div > a[role=tab] > span");
        for (let i = 0; i < profileAboutCategoryLinkHandles.length; i++) {
            const elementHandle = profileAboutCategoryLinkHandles[i];
            await elementHandle.click().catch((err)=>{
                let errMsg = `Unable to click on profile category link`;
                console.log(errMsg);
                this.#errorLogger.error(errMsg);
                this.#errorLogger.error(err);
            });
            await profilePage.waitForNetworkIdle({ concurrency: 4 }).catch(()=>{
                let errMsg = `Timed out waiting prfoile about network idle.`;
                console.log(errMsg);
                this.#errorLogger.error(errMsg);
            });
            aboutHeader = (await profilePage.$$("div > h2[dir=auto]"))[0];
            aboutContainer = await (await aboutHeader.getProperty('parentElement')).getProperty('parentElement');
            profileAboutCategoryLinkHandles = await aboutContainer.$$("div > a[role=tab] > span");
        }
        console.log(`Profile Url: ${profile_url}`);
        //Since all the data about profile is scraped from response interception code below is unccessary now.
        /*
        let datasjsscrips =  await profilePage.$$("script[data-sjs]");
        let sjsJson = null;
        for (let i = 0; i < datasjsscrips.length; i++) {
            const script = datasjsscrips[i];
            let innerText = await(await script.getProperty("innerText")).jsonValue();
            if(innerText.includes("field_type")){
                sjsJson = JSON.parse(innerText);                                
                break;
            }
        }
        //this.searchJSON(sjsJsonIntroCard,"timeline_context_list_item_type",[]);        
        if(!sjsJson){
            return null;
        }       
        let dataObject = this.#findDataObject(sjsJson);
        let fieldSections = dataObject["3"]["1"]["__bbox"]["result"]["data"]["user"]["about_app_sections"]["nodes"]["0"]["activeCollections"]["nodes"]["0"]["style_renderer"]["profile_field_sections"];        
        for (let i = 0; i < fieldSections.length; i++) {
            const fieldSection = fieldSections[i];
            let profileFields = fieldSection["profile_fields"]["nodes"];
            for (let j = 0; j < profileFields.length; j++) {
                const profileField = profileFields[j];
                if(profileField["field_type"] == "null_state") continue;
                profileData[profileField["field_type"]] = 
                (!!profileField["renderer"] && !!profileField["renderer"]["field"]["text_content"]) ?
                 profileField["renderer"]["field"]["text_content"]["text"] : profileField["title"]["text"];
            }
        }*/
        await profilePage.close();
        if(!!profileData.website && Array.isArray(profileData.website)){
            profileData.website = profileData.website.join(",");
        }
        return profileData;
    }

    searchJSON = (obj,varName,stack) => {
        if(!obj) return;
        let keys = Object.keys(obj);
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            if(key == varName){
                console.log(JSON.stringify(stack));
                console.log(this.pathStackToStr(stack));
                //return;                
            }
            if(typeof obj[key] == "object" && !!obj[key]){
                stack.push(key);
                let result = this.searchJSON(obj[key],varName,stack);
                if(result == null) stack.pop();
            }
        }
        return null;
    }

    pathStackToStr = (stack) => {
        let str = "";
        for (let i = 0; i < stack.length; i++) {
            const key = stack[i];
            str+= `["${key}"]`;
        }
        return str;
    }

    #findDataObject = (sjsJson) => {
        let array = sjsJson["require"]["0"]["3"]["0"]["__bbox"]["require"];
        let dataObject = null;
        for (let i = 0; i < array.length; i++) {
            const item = array[i];
            if(item.length <= 3) continue;
            if(!!item["3"] && !!item["3"]["1"] && !!item["3"]["1"]["__bbox"]){
                return item;
            }
        }
    }

    #postDataStringToJson = (postDataString) => {
        let vars = postDataString.split("&");
        let postData = {};
        for (let i = 0; i < vars.length; i++) {
            const v = vars[i];
            let keyValArr = v.split("=");
            postData[keyValArr[0]] = keyValArr[1];
        }
        return postData;
    }

    #delay = ms => new Promise(res => setTimeout(res, ms));

    #delayRandom  = async (msRangeStart,msRangeEnd) =>{
        let random = parseInt(Math.random() * (msRangeEnd - msRangeStart) + msRangeStart);
        console.log(`Waiting for ${random} milliseconds`);
        await this.#delay(random);
    }

    navigate = async (url) => {
        if (!url) return false;

        console.log('[FB] navigate() START', url);

        await this.#fbpage.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });

        // short, controlled wait instead of networkIdle
        await this.#delay(2000);

        console.log('[FB] navigate() DONE');
        return true;
    };

    clickMessageButton = async () => {
        console.log('[FB] clickMessageButton() START');

        const clicked = await this.#fbpage.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('div[role="button"]'));
            const btn = buttons.find(b => b.innerText.trim() === 'Message');
            if (!btn) return false;
            btn.click();
            return true;
        });

        console.log('[FB] clickMessageButton() RESULT', clicked);
        return clicked;
    };

    hasMessageInput = async () => {
        console.log('[FB] hasMessageInput() START');

        try {
            const input = await this.#fbpage.$("textarea, div[contenteditable='true']");
            console.log('[FB] hasMessageInput() RESULT', !!input);
            return !!input;
        } catch (e) {
            console.log('[FB] hasMessageInput() ERROR', e.message);
            return false;
        }
    };

    typeMessage = async (message) => {
        console.log('[FB] typeMessage() START');

        try {
            const input = await this.#fbpage.$("textarea, div[contenteditable='true']");
            if (!input) {
                console.log('[FB] typeMessage() NO INPUT');
                return false;
            }

            await input.type(message, { delay: 20 });
            console.log('[FB] typeMessage() DONE');
            return true;
        } catch (e) {
            console.log('[FB] typeMessage() ERROR', e.message);
            return false;
        }
    };

    clickSendButton = async () => {
        console.log('[FB] clickSendButton() START');

        try {
            // give FB time to enable send
            await new Promise(res => setTimeout(res, 1000));

            // ENTER is the real send trigger
            await this.#fbpage.keyboard.press('Enter');

            await new Promise(res => setTimeout(res, 1000));

            console.log('[FB] clickSendButton() SENT VIA ENTER');
            return true;
        } catch (err) {
            console.log('[FB] clickSendButton() ERROR', err.message);
            return false;
        }
    };
}

module.exports = FBController;
