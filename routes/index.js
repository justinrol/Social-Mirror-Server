var express = require('express');
var router = express.Router();

var moment = require('moment');

var pg = require('pg')
// var connectionString = process.env.DATABASE_URL ||'postgres://root:sociogram2016@139.59.162.2/sociogram'
var connectionString = process.env.DATABASE_URL ||'postgres://root:sociogram2016@localhost/sociogram'
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
		
		console.log(query_string);
		console.log("\n");
		query.on('error',function(err){
				return res.status(500).json({success:false,data:err});
			}).on('row',function(row){
				data.push(row);
			}).on('end',function(){
				done();
				console.log()
				return res.json(data);
			});
	})
}

router.get('/dbserver',function(req,res){
	res.json({success:true, message: "I'm turned on.."});
})

router.post('/login',function(req,res){
	
	var username = req.body.username;
	var password = req.body.password;

	console.log(`User attempting login with username : ${username} and ${password}`);

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
				return res.json({success:true});

		})
	})
})

router.get('/getuserlist/:user', function(req, res) {

	var user = req.params.user;
	var query_string = `SELECT username,name,email,gender,age FROM users WHERE (name ILIKE '%${user}%' ) OR (username ILIKE '%${user}%')`;

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
	db_query(query_string,res);
});

router.post('/post',function(req,res){
	var d = req.body; // details
	var columns = 'date, author, recipient, content, is_private, agree, disagree';
	var params = `'${d.date}','${d.author}','${d.recipient}','${d.content}','${d.is_private}','${d.agree}','${d.disagree}'`;

	var query_string = 'INSERT INTO posts ( ' + columns + ' ) VALUES ( ' + params + ' )';

	db_query(query_string,res);  
})

router.post('/friendpost',function(req,res){
	var d = req.body;
	var columns = 'posts.id, content, agree, disagree';
	var query_string = 'SELECT '+ columns +' FROM posts INNER JOIN friends ON (posts.author = friends.username) ' +
						'WHERE is_private = false AND ' +
						`friends.visible_to = '${d.user}' order by date`
	db_query(query_string,res);	
});

router.post('/postto',function(req,res){
	var d = req.body;
	var columns = 'id, date, author, content, is_private, agree, disagree';
	var query_string = `SELECT ` + columns + ` FROM posts WHERE recipient = '${d.user}'`

	db_query(query_string,res);
});

router.post('/publicpostto',function(req,res){
	var d = req.body;
	var columns = 'id,date,content,agree,disagree';
	var query_string = 'SELECT ' + columns + ` FROM posts WHERE recipient = '${d.user}' AND is_private = 'false' ORDER BY date`;

	db_query(query_string,res);
});

router.post('/updateprivacy',function(req,res){
	var d = req.body;
	var query_string = `UPDATE posts SET is_private = '${d.private}' WHERE id = '${d.id}'`;

	db_query(query_string,res);
});

router.post('/addfriend',function(req,res){
	var d = req.body;
	var query_string = `INSERT INTO friends ( username , visible_to ) VALUES ( '${d.username}', '${d.visible_to}')`;

	db_query(query_string,res);
});

router.post('/addcustomfeature',function(req,res){
	var d= req.body;
	var query_string = `INSERT INTO custom_features (username, feature) VALUES ('${d.username}', '${d.feature}')`

	db_query(query_string,res);
});

router.post('/getcustomfeatures',function(req,res){
	var d= req.body;
	var query_string = `SELECT feature FROM custom_features WHERE username = '${d.username}'`

	db_query(query_string,res);
})

router.post('/getallfeatures',function(req,res){
	var d= req.body;
	var query_string = `SELECT name, value FROM features WHERE username = '${d.username}'`;

	db_query(query_string,res);
});

router.get('/getstats/:att',function(req,res){

	var att = req.params.att;

	pg.connect(connectionString, function(err, client, done){
		if(err){
			done();
			return res.status(500).json({success:false, data:err});
		}

		var query = client.query(`SELECT ${att} FROM avg_user_attributes`);
		var data = [];
		query.on('row',function(row){
			data.push(row);
		})
		.on('end',function(){
			
			var avg = get_mean (data);
			
			var variance = get_variance (data);
			var std_deviation = Math.sqrt(variance).toFixed(3);
			return res.json({attribute : `${att}`,
							mean : avg, 
							variance : variance, 
							std_deviation : std_deviation});
		})
		.on('error',function(err){
			res.status(500).json({success:false,data:err});
		})
	})
});

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
});

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
		var update_query = client.query('SELECT quantity FROM contributions '+`WHERE username = '${user_to}'`);
		update_query.on('error',function(err){
			return res.status(500).json({success:false, data:err})
		})
		.on('row',function(row){
			data.push(row);
		})
		.on('end',function(){
			var new_mean = get_mean(data);
			console.log("****Mean is : " + new_mean);
			var update_user_avg = client.query('UPDATE features '
												+ `SET value = ${new_mean} `
												+ `WHERE username = '${user_to}' AND name = '${attribute}'`	
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

router.post('/update-agree',function(req,res){
	var d= req.body;
	var query_string = `UPDATE posts SET agree = agree + 1 WHERE id = ${d.id}`;
})

router.post('/update-disagree',function(req,res){
	var d = req.body;
	var query_string = `UPDATE posts SET disagree = disagree + 1 WHERE id = ${d.id}`
})

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
