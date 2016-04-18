var express = require('express');
var router = express.Router();

var pg = require('pg')
var connectionString = process.env.DATABASE_URL || 'postgress://localhost:5432/sociogram';

router.get('/getuserlist/:name', function(req, res) {

	var userName = req.params.name;

	pg.connect(connectionString, function (err, client, done) {

		var results = [];

		if(err) {
			done();
			return res.status(500).json({success:false, data: err});
		}

		var query = client.query(`SELECT name FROM users WHERE name ILIKE '%${userName}%	'`);

		query.on('row', function(row){
			results.push(row)
		})
		.on('end', function(){
			done();
			return res.json(results);
		});
	});
});

router.get('/getuserdetail/:user',function (req, res){

	var myUser = req.params.user;

	pg.connect(connectionString, function(err, client, done){
		var results=  [];
		if (err) {
			done(); 
			return res.status(500).json({success:false, data:err});
		}

		var query = client.query(`SELECT username, name, friends, gender, age FROM 'users'
									WHERE username = '${myUser}'`);

		query
		.on('row',function(row){
			results.push(row);
		})
		.on('end',function(){
			return res.json(results);
		})
	})
})

router.get('/getfriendlist/:user', function(req, res) {
	
	var myUser = req.params.user;

	pg.connect(connectionString, function (err, client, done) {

		var results = [];

		if(err) {
			done();
			return res.status(500).json({success:false, data: err});
		}

		var query = client.query(`SELECT username,friends FROM users WHERE users.username = '${myUser}'`);

		query.on('row', function(row){
			results.push(row)
		})
		.on('end', function(){
			done();
			return res.json(results);
		});
	});
});

router.post('/signup',function(req,res) {
	
	pg.connect(connectionString, function (err, client, done) {

		var userInfo = req.body;
		var values = [];
		var str_values = '';

		for(var key in userInfo) {
			userInfo[key] = userInfo[key].replace(/'/g,'"');
			values.push(userInfo[key]);
		}
 	
		if(err) {
			done();
			return res.status(500).json({success:false, data:err});
		}

		var query = client.query(`INSERT INTO users (`
									+ 'username, name, encrypted_password, email'
									+ ') VALUES ('
									+ `'${values[4]}','${values[0]}','${values[1]}','${values[2]}','${values[3]}'`
									+ ')'
							,function(err, results){
								if(err) {
									return res.status(400).json({success:false});
								} else {
									return res.status(200).json({success:true});
								}
							});
	});
});

router.get('/getstats/:attribute',function(req,res){

	var myAttribute = req.params.attribute;

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
			var std_deviation = Math.sqrt(variance);
			return res.json({attribute : `${myAttribute}`,
							mean : avg, 
							variance : variance, 
							std_deviation : std_deviation});
		})
	})
})

router.get('/userinfo/:username',function(req,res){
  
  var userName = req.params.username;
  
  pg.connect(connectionString,function(err,client,done) {
      if(err){
			done();
			return res.status(500).json({success:false, data:err});
		}
    
      var query = client.query*'SELECT'
  })
  
})

router.post('/contribute',function (req,res){
	
	var user_from = req.body.user_from;
	var user_to = req.body.user_to;
	var attribute_name = req.body.attribute;
	var quantity = req.body.quantity;

	console.log(req.body);

	pg.connect(connectionString, function(err, client, done){
		if(err){
			done();
			return res.status(500).json({success:false,data:err});
		}
		var query = client.query('INSERT INTO contributions (user_from, user_to, attribute_name, quantity) '
								+ ' VALUES ('
								+ `'${user_from}','${user_to}','${attribute_name}',${quantity}`)`
							
							);

		var data = [];

		var update_query = client.query('SELECT user_to, attribute_name FROM contributions');
		update_query.on('row',function(row){
			data.push(row);
		})
		.on('end',function(){
			var new_mean = get_mean(data);
			var update_user_avg = client.query('UPDATE avg_user_attributes '
												+ `SET ${attribute_name} = ${new_mean} `
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
		sum += elem;
	}
	return sum / arr.length;
}

function get_variance(arr){
	var sum = 0;
	var avg = get_mean ( arr );
	for(var elem in arr) {
		sum += (elem - avg) * (elem - avg);
	}
	return sum / arr.length;
}


module.exports = router;
