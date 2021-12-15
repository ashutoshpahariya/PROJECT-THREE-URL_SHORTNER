const urlModel = require("../models/urlModel")

//---NPM PACKAGE--valid-url,shortid,redis,util
const validUrl = require('valid-url')
const shortid = require('shortid')
const redis = require("redis");
const { promisify } = require("util");

//---------------- REDIS PUBLIC ENDPOINT
const redisClient = redis.createClient(
  18842, "redis-18842.c62.us-east-1-4.ec2.cloud.redislabs.com",
  { no_ready_check: true }
);
//---------------- REDIS PASSWORD
redisClient.auth("GLhI3EzZ2sCFeKyyKRQzdHPGWOoqgoDg", function (err) {
  if (err) throw err;
});
//---------------- CONNECT TO REDIS 
redisClient.on("connect", async function () {
  console.log("Connected to Redis..");
})

//----------------REDIS VARIABLE
const SET_ASYNC = promisify(redisClient.SET).bind(redisClient);
const GET_ASYNC = promisify(redisClient.GET).bind(redisClient);

//-----------------ISVALID FUNCTION
const isValid = function (value) {
  if (typeof value === 'undefined' || value === null) return false
  if (typeof value === 'string' && value.trim().length === 0) return false
  return true;
}
//-----------------ISVALIDREQUEST BODY FUNCTION
const isValidRequestBody = function (college) {
  return Object.keys(college).length > 0
}
//------------BASE URL
const baseUrl = "http://localhost:3000";

//-----------FIRST API GENERATE SHORT URL
const createurl = async function (req, res) {
  try {
    if (!isValidRequestBody(req.body)) {
      res.status(400).send({ status: false, message: 'Invalid request parameters. Please provide URL details' })
      return
    }
    if (!isValid(req.body.longUrl)) {
      return res.status(400).send({ status: false, message: ' Please provide LONG URL' })
    }
    const longUrl = req.body.longUrl.trim()

    ///----URL VALIDATION
    const validUrl = '^(?!mailto:)(?:(?:http|https|ftp)://)(?:\\S+(?::\\S*)?@)?(?:(?:(?:[1-9]\\d?|1\\d\\d|2[01]\\d|22[0-3])(?:\\.(?:1?\\d{1,2}|2[0-4]\\d|25[0-5])){2}(?:\\.(?:[0-9]\\d?|1\\d\\d|2[0-4]\\d|25[0-4]))|(?:(?:[a-z\\u00a1-\\uffff0-9]+-?)*[a-z\\u00a1-\\uffff0-9]+)(?:\\.(?:[a-z\\u00a1-\\uffff0-9]+-?)*[a-z\\u00a1-\\uffff0-9]+)*(?:\\.(?:[a-z\\u00a1-\\uffff]{2,})))|localhost)(?::\\d{2,5})?(?:(/|\\?|#)[^\\s]*)?$';
    if (!(longUrl.match(validUrl))) {
      return res.status(400).send({ status: false, msg: "longurl is not valid" })
    }

    const baseUrl = 'http://localhost:3000'

    //---GENERATE URLCODE
    let urlCode = shortid.generate().match(/[a-z\A-Z]/g).join("") //---this will give only Alphabet
    urlCode = urlCode.toLowerCase()//---this will gives only lowercase alphabet

    //---FETCH THE DATA IN REDIS
    let checkforUrl = await GET_ASYNC(`${longUrl}`)
    if (checkforUrl) {
      console.log("line no66")
      return res.status(200).send({ status: true, "data": JSON.parse(checkforUrl) })
    }

    //---FETCH THE DATA IN MONGO DB IF IT IS NOT PRESENT IN CACHE
    let url = await urlModel.findOne({ longUrl })
    if (url) {
      return res.status(200).send({ status: true, "data": url }) //---if already exist
    }

    //---GENERATE DATA BY LONG URL
    const shortUrl = baseUrl + '/' + urlCode
    const urlData = { urlCode, longUrl, shortUrl }
    const newurl = await urlModel.create(urlData);

    //---SET GENERATE DATA IN CACHE
    await SET_ASYNC(`${longUrl}`, JSON.stringify(urlData))
    return res.status(201).send({ status: true, msg: `URL created successfully`, data: newurl });
  } 
  catch (err) {
    console.log(err)
    res.status(500).send({ status: false, msg: 'Server Error' })
  }
}




//-----------SECOND API PULL LONG URL BY REDIRECTING
const geturl = async function (req, res) {
  try {
    const urlCode = req.params.urlCode.trim().toLowerCase()
    if (!isValid(urlCode)) {
      res.status(400).send({ status: false, message: 'Please provide valid urlCode' })
      console.log()
    }

    //---FETCH THE DATA BY URLCODE IN REDIS
    let checkforUrl = await GET_ASYNC(`${urlCode}`)
    if (checkforUrl) {
      return res.redirect(302, checkforUrl)
    }

    //---FETCH THE DATA IN MONGO DB IF IT IS NOT PRESENT IN CACHE
    const url = await urlModel.findOne({ urlCode: urlCode })
    if (!url) {
      return res.status(404).send({ status: false, message: 'No URL Found' })
    }

    //---SET GENERATE DATA IN CACHE
    await SET_ASYNC(`${urlCode}`, JSON.stringify(url.longUrl))
    return res.redirect(302, url.longUrl)
  } catch (err) {
    res.status(500).send('Server Error')
  }
}

module.exports.createurl = createurl
module.exports.geturl = geturl
