var express = require('express');
var router = express.Router();

var moment = require('moment');

var pg = require('pg')
var connectionString = process.env.DATABASE_URL ||'postgres://root:sociogram2016@139.59.162.2/sociogram'
// var connectionString = process.env.DATABASE_URL ||'postgres://root:sociogram2016@localhost/sociogram'
router.get('/',function(req,res){
  res.render('index');
})

var db_query = function(query_string,res){
	pg.connect(connectionString, function(err, client, done){
		if(err){
			console.log(err);
			done(); return res.status(500).json({ success : false , data : err });
		}

		var data = [];
		var query = client.query(`${query_string}`);
		
		console.log(query);
		query.on('row',function(row){
			data.push(row);
			}).on('end',function(){
				done();
				return res.json(data);
			}).on('error',function(err){
				res.status(500).json({success:false,data:err});
			});
	})
}
router.post('/login',function(req,res){
	console.log(req.body);
	var username = req.body.username;
	var password = req.body.password;

	console.log(username);

	pg.connect(connectionString,function(err,client,done){
		if(err){
			done(); return res.status(500).json({success:false,data:err});
		}
		
		var data = [];
	
		var query = client.query(`SELECT username FROM users where username = '${username}' AND encrypted_password = '${password}'`);
		query.on('row',function(row){
			data.push(row);
		}).on('end',function(){
			console.log(data);
			if(data.length == 0){

				return res.json({success:false}); 
			} else 
				var randomString = "dummy dum dum"
				var time = moment().add(30,'minutes').format('YYYY-MM-DD h:mm:ss ');
				console.log(time);
				var columns = 'username, sessionid, expire_time';
				var params = `'Steezy','randomString','${time}'`;

				var session_data = [];
				var session_query = client.query('INSERT INTO session ( ' + columns + ' ) VALUES ( ' + params + ')');
					session_query.on('error',function(err){
						console.log(err);
					}).on('row',function(row){
						session_data.push(row);
					}).on('end',function(){
						console.log(session_data);
					})
				return res.json({success:true});
			console.log('ended');
		})
	})
})

router.get('/getuserlist/:user', function(req, res) {

	var user = req.params.user;
	var query_string = `SELECT username FROM users WHERE name ILIKE '%${user}%'`;

	db_query(query_string,res);
});

router.get('/getuserdetail/:user',function (req, res){

	var user = req.params.user;
	var query_string = `SELECT username, name, gender, age FROM users WHERE username = '${user}'`;

	db_query(query_string,res);
});

router.get('/getfriendlist/:user', function(req, res) {
	
	var user = req.params.user;
	var query_string = `SELECT visible_to FROM friends WHERE username = '${user}'`;

	db_query(query_string,res);
});

router.post('/signup',function(req,res) {

	var user = req.body;

	console.log(user);
	var columns = 'username, name, encrypted_password, email, gender, age';
	var params = `'${user.username}','${user.name}','${user.password}','${user.email}','${user.gender}','${user.age}'`

	var query_string = 'INSERT INTO users ( ' + columns + ' ) VALUES ( ' + params + ' )';
	console.log(query_string);
	db_query(query_string,res);
});

router.post('/post',function(req,res){
	var d = req.body; // details
	var columns = 'date, author, recipient, content, is_private, agree, disagree';
	var params = `'${d.date}','${d.author}','${d.recipient}','${d.content}','${d.is_private}','${d.agree}','${d.disagree}'`;

	console.log(d);

	var query_string = 'INSERT INTO posts ( ' + columns + ' ) VALUES ( ' + params + ' )';

	db_query(query_string,res);  
})

router.post('/friend-post',function(req,res){
	var d = req.body;
	var query_string = 'SELECT content, agree, disagree FROM posts INNER JOIN friends ON (posts.author = friends.username) ' +
						'WHERE is_private = false AND ' +
						`friends.visible_to = '${d.user}' order by date`
	db_query(query_string,res);	
});

router.post('/post-to',function(req,res){
	var d = req.body;
	var columns = 'date, author, content, is_private, agree, disagree';
	var query_string = `SELECT ` + columns + ` FROM posts WHERE recipient = '${d.recipient}'`

	db_query(query_string,res);
})

router.get('/getstats/:att',function(req,res){

	var att = req.params.att;

	pg.connect(connectionString, function(err, client, done){
		if(err){
			done();
			return res.status(500).json({success:false, data:err});
		}

		var query = client.query(`SELECT ${myAttribute} FROM avg_user_attributes`);
		var data = [];
		query.on('row',function(row){
			data.push(row);
		})
		.on('end',function(){
			
			var avg = get_mean (data);
			
			var variance = get_variance (data);
			var std_deviation = Math.sqrt(variance).toFixed(3);
			return res.json({attribute : `${myAttribute}`,
							mean : avg, 
							variance : variance, 
							std_deviation : std_deviation});
		})
	})
})

router.get('/userstats/:username/:attribute',function(req,res){
	var user = req.params.username;
	var attribute = req.params.attribute;

	pg.connect(connectionString,function(err, client, done){
		if(err){
			done();
			return res.json(500).json({success:false,data:err});
		}

		var query_string = `SELECT ${attribute} FROM avg_user_attributes WHERE username = '${user}'`;
		db_query(query_string,res);
	})
})

router.post('/contribute',function (req,res){
	
	var user_from = req.body.user_from;
	var user_to = req.body.user_to;
	var attribute = req.body.att;
	var quantity = req.body.quantity;

	pg.connect(connectionString, function(err, client, done){
		if(err){
			done();
			return res.status(500).json({success:false,data:err});
		}
		var query = client.query('INSERT INTO contributions (user_from, user_to, attribute, quantity) '
								+ `VALUES ('${user_from}','${user_to}','${attribute}',${quantity})`);
		var data = [];
		var update_query = client.query('SELECT user_to, attribute FROM contributions');
		update_query.on('row',function(row){
			data.push(row);
		})
		.on('end',function(){
			var new_mean = get_mean(data);
			var update_user_avg = client.query('UPDATE avg_user_attributes '
												+ `SET ${attribute} = ${new_mean} `
												+ `WHERE username = '${user_to}'`
											,function(err,results){
												if(err) {	
													return res.status(400).json({success:false});
												} else {
													return res.status(200).json({success:true});
												}
											});
		});
	});
});


function get_mean(arr){
	var sum = 0;
	for(var elem in arr){
		elem = arr[elem];
		for(var key in elem){
			sum += elem[key];	
		}
	}
	return (sum / arr.length).toFixed(3);
}

function get_variance(arr){
	var sum = 0;
	var avg = get_mean ( arr );
	for(var elem in arr) {
		elem = arr[elem];
		for(var key in elem){
		sum += (elem[key] - avg) * (elem[key] - avg);
		}
	}
	return (sum / arr.length).toFixed(3);
}


module.exports = router;
