var express = require('express');
var multer = require('multer');
var fs = require('fs');
var FCM = require('fcm-node');
var serverKey = 'AAAA17V7QX0:APA91bEkWiCjSKIflemWoiQd3FHW_-PTF8_1JQaPFnQ6umlt_5batFcQF0VvzGpTrDKxhG1PXB4mscu4m-ohq8uO1qbVzgW98y49NvRls3dbEbnhmTiOBCC9BjZGfXy2lg-g3RF4Komk';
var fcm = new FCM(serverKey);
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var app = express();
var uri = 'mongodb://somrak:58364685@localhost/project';
//mongoose.set('debug', true);
var db = mongoose.connect(uri, { useNewUrlParser: true });

function sendNotification(title, body, notitype, id, clickaction){
	var imgurl = "http://35.240.254.46:5000/showimg/"+notitype+"/"+id;
	var message = {
		to: "/topics/ANDROID",
		notification: {
			title: title,
			body: body,
			image: imgurl,
			click_action: clickaction
		}
	}

	fcm.send(message, function(err, response){
        	if (err) {
        		console.log("Something has gone wrong!");
        	} else {
        		console.log("Successfully sent "+notitype+" notification");
		}
	});
}

var upload = multer({
	storage:multer.diskStorage({
		destination: function (req, file, cb){
                        cb(null,'images')
                },
		filename: function (req, file, cb){
			cb(null,file.fieldname+'-' + Date.now() + '.jpg')
		}
	})
});

var SmokeSchema = new Schema({
	timeStamp: {type: Date, default: Date.now},
	img: {data: Buffer, contentType: String}
});

var Dsmoke = mongoose.model('Dsmoke', SmokeSchema);

app.post('/pushsmoke', upload.single('smoke'), (req, res) => {
	console.log(req.body);
	var dsmoke = new Dsmoke({});
	var smoke_img = fs.readFileSync(req.file.path);
        dsmoke.img.data = smoke_img;
        dsmoke.img.contentType = req.file.mimetype;
	dsmoke.save(function(err, dsmokes) {
		if(err){
			return consule.error(err);
		} else{
			res.json({
				'status':'saved to database',
				'timestamp':dsmokes.timestamp
			});
			sendNotification("Smoke detection", "Smoke aleart!!!", "smoke", dsmokes._id, "CAMERAACTIVITY");
			console.log('detected smoke and saved to _id:' + dsmokes._id);
		}
	});
	fs.unlinkSync(req.file.path);
});

var UserSchema = new Schema({
	UID: Number,
	realname: String,
	nickname: String,
	gender: String,
	DOB: Date,
	age: Number,
	social: String,
	img: {data: Buffer, contentType: String}
});
var UserModel = mongoose.model('User', UserSchema);

app.post('/adduser', upload.single('image'), (req, res) => {
	console.log(req.body);
	console.log(req.file);
	var user = new UserModel({
		UID: req.body.UID,
		realname: req.body.realname,
		nickname: req.body.nickname,
		gender: req.body.gender,
		DOB: req.body.DOB,
		age: req.body.age,
		social: req.body.social
	});
	var profile_img = fs.readFileSync(req.file.path);
	user.img.data = profile_img;
	user.img.contentType = req.file.mimetype;
	user.save(function(err, user) {
		if(err){
			return console.error(err);
		} else{
			res.json({
				'status':'saved to database'
			});
		}
	});
	fs.unlinkSync(req.file.path);
});

var PersonSchema = new Schema({
	UID: Number,
	description: String,
	timeStamp: {type: Date ,default: Date.now},
	face: {data: Buffer, contentType: String},
	frame: {data: Buffer, contentType: String}
});
var Dperson = mongoose.model('Dperson', PersonSchema);

app.post('/pushperson', upload.array('person', 2), (req, res) => {
	console.log(req.body);
	console.log(req.files);
	var dperson = new Dperson({
		UID: req.body.UID,
		description: req.body.description
	});

	var paths = req.files.map(file => file.path);
	var mimetypes = req.files.map(file => file.mimetype);
	var read_frame = fs.readFileSync(paths[0]);
	var read_face = fs.readFileSync(paths[1]);
	dperson.frame.data = read_frame;
	dperson.frame.contentType = mimetypes[0];
	dperson.face.data = read_face;
	dperson.face.contentType = mimetypes[1];
	dperson.save(function(err, dpersons) {
		if(err){
			return console.error(err);
		} else{
			res.json({
				'state':'saved to batabase',
				'UID':dpersons.UID,
				'description':dpersons.description,
				'timestamp':dpersons.timestamp
			});
			sendNotification("Person detection", dpersons.description, "person", dpersons._id, "PERSONACTIVITY");
			console.log('detected person and saved to _id:' + dpersons._id);
		}
	});
	fs.unlinkSync(paths[0]);  //delete buffer image
	fs.unlinkSync(paths[1]);
});

app.get('/getrecent', (req,res,next) => {
	Dperson.aggregate([
		{$group:
    			{_id: "$UID",
			face: {$last: "$face"},
			frame: {$last: "$frame"},
			description: {$last: "$description"},
			timeStamp: {$last: "$timeStamp"},
			oid: { $last: "$_id" }
		}
	},
		{$project:
			{_id: "$oid",
			face: "$face",
			frame: "$frame",
			UID: "$_id",
			description: "$description",
			timeStamp: "$timeStamp",
		}
	},
		{$sort: {timeStamp: 1}
	}], function(err, docs){
		if(err) return next(err);
		var list = [];
		console.log('GET Recent Person data');
		docs.forEach(function(doc){
			var bufferdata = {};
			bufferdata._id = doc._id;
			bufferdata.UID = doc.UID;
			bufferdata.description = doc.description;
			bufferdata.timestamp = doc.timeStamp;
			list.unshift(bufferdata);
		});
		console.log("GET "+list.length+" records");
		res.json(list);
	});

});

app.get('/userdata/:uid', (req, res, next) => {
	UserModel.findOne({UID:req.params.uid} , function (err, doc) {
		if(err) return next(err);
		var list = [];
		var bufferdata = {};
		bufferdata._id = doc._id;
		bufferdata.UID = doc.UID;
		bufferdata.realname = doc.realname;
		bufferdata.nickname = doc.nickname;
		bufferdata.gender = doc.gender;
		bufferdata.DOB = doc.DOB;
		bufferdata.age = doc.age;
		bufferdata.social = doc.social;
		console.log(bufferdata);
		list.unshift(bufferdata);
		console.log("GET User data");
		res.json(list);
	});
});

app.get('/getperson/:uid/:n', (req, res) => {
	Dperson.find({UID: req.params.uid}).sort({$natural:-1}).limit(Number(req.params.n)).exec(function (err, docs){
		if(err) console.log(err);
		var list = [];
		console.log('GET Person data UID: '+req.params.uid);
		docs.forEach(function(doc){
			var bufferdata = {};
			bufferdata._id = doc._id;
			bufferdata.UID = doc.UID;
			bufferdata.description = doc.description;
			bufferdata.timestamp = doc.timeStamp;
			list.push(bufferdata);
		});
		console.log('GET '+list.length+' records');
		res.json(list);
	});
});

app.get('/getdata/:noti', (req, res, next) => {
	if(req.params.noti === 'person'){
		Dperson.find({}, function (err, docs) {
			if (err) return next(err);
			var list = [];
			console.log('GET all Person data');
			docs.forEach(function(doc){
				var testformat = {};
				testformat._id = doc._id;
				testformat.UID = doc.UID;
				testformat.description = doc.description;
				testformat.timestamp = doc.timeStamp;
				list.unshift(testformat);
			});
			console.log("GET "+list.length+" records");
                        res.json(list);
		});
	}
	else if(req.params.noti === 'smoke'){
                Dsmoke.findOne({}, function (err, doc) {
                        if (err) return next(err);
                        console.log('GET all Smoke data');
                        res.contentType('json');
                        res.send(doc);
                });
        } else{
                console.log('No Notification params');
        }
});

app.get('/showimg/:noti/:_id', (req, res, next) => {
	if(req.params.noti === 'frame'){
		Dperson.findById(req.params._id, function (err, doc) {
			if (err) res.send("Cannot find image please check _id");
			else{
				console.log('GET FRAME img _id: '+doc._id);
				res.contentType('image/jpeg');
   				res.send(doc.frame.data);
			}
		});
	} else if(req.params.noti === 'face'){
		Dperson.findById(req.params._id, function (err, doc) {
                        if (err) res.send("Cannot find image please check _id");
                        else{
                                console.log('GET FACE img _id: '+doc._id);
                                res.contentType('image/jpeg');
                                res.send(doc.face.data);
                        }
                });
	} else if(req.params.noti === 'profile'){
		UserModel.findOne({UID:req.params._id}, function (err,doc) {
			if (err) res.send("Cannot find this profile image");
			else{
				console.log('GET Profile '+doc.UID+' image');
				res.contentType('image/jpeg');
				res.send(doc.img.data);
			}
		});
	} else if(req.params.noti === 'smoke'){
		Dsmoke.findById(req.params._id, function (err, doc) {
                        if (err) res.send("Cannot find image please check _id");
                        else{
				console.log('GET Smoke img _id: '+doc._id);
                        	res.contentType('image/jpeg');
                        	res.send(doc.img.data);
			}
                });
	} else{
		console.log('No Notification params');
	}
});

app.use('/static', express.static('images'));

app.listen(5000, () => {
	console.log('Start server at port 5000');
});
