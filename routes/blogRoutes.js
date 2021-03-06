//importing the necessary modules
var md5 = require("md5");
var im = require("imagemagick");

var variables = require("./formatVariables");

module.exports = function(app, router, authenticate, con){
	router.route("/blogs/public")
.get(function(req, res){
	var query = "SELECT * FROM blogs inner join blog_images on blogs.blog_id = blog_images.blog_id WHERE published = 1 LIMIT 10";
	con.query(query, function(err, data){
		if(err){
			res.status(400).json(err);
			return;
		}
		res.status(200).json(data);
	});
});

// ### Adding categories and listing categories
	router.route("/blogs/categories")
.post(authenticate, function(req, res){
	if(!req.body.category_name || !req.body.category_details){
		res.status(400).json({"message": "Request Format Error", "required": variables.category});
	}
	else{
		var data = {"category_name": req.body.category_name, "category_details": req.body.category_details};
		var addCategory = "INSERT INTO categories SET ?";
		con.query(addCategory, data, function(err){
			if(err){
				var response = {
					"message": "Cannot add category",
					"error": err
				};
				res.status(400).json(response);
			}
			else{
				res.status(201).json({"message": "Created Category Successfully"});
			}
		});
	}
})
.get(authenticate, function(req, res){
	var allCategories = "SELECT * FROM categories";
	con.query(allCategories, function(err, data){
		if(err){
			var response = {
				"message": "Cannot show categories",
				"error": err
			};
			res.status(400).json(response);
		}
		else{
			res.status(200).json(data);
		}
	});
});

// ### Adding and listing all the blogs
//permissions, different responses and filters for different roles
	router.route("/blogs")
.post(authenticate, function(req, res){
	if(!req.body.blog_title || !req.body.blog_body || !req.body.category_id || !req.body.user_id){
		res.status(400).json({"message": "Request Format Error", "required": variables.blog});
	}
	else{
		var addBlog = "INSERT INTO blogs SET ?";
		var data = {"blog_title": req.body.blog_title, "blog_body": req.body.blog_body, "category_id": req.body.category_id, "user_id": req.body.user_id};
		con.query(addBlog, data, function(err, data){
			if(err){
				var response = {
					"message": "Cannot add blog",
					"error": err
				};
				res.status(400).json(response);
			}
			else{
				var response2 = {
					"blog_id": data.insertId
				};
				res.status(201).json(response2);
			}
		});
	}
})
.get(authenticate, function(req, res){
//allowed filter => user_id, published, category_id
	var getBlogs = "";
	if(req.userRole == "user"){
		getBlogs = "select * from blog_images inner join (select categories.category_details, categories.category_name, BLDU.* from categories inner join (select users.username, users.email, BLD.* from users inner join (select * from blogs inner join (select X.*, Count(comment) as commentCount from comments right outer join (select blogs.blog_id as blog_likes_id, COUNT(liked) as likeCount from blogs left outer join likes on blogs.blog_id = likes.blog_id GROUP BY blogs.blog_id) X on X.blog_likes_id = comments.blog_id GROUP by X.blog_likes_id) BL on blogs.blog_id = BL.blog_likes_id) BLD on BLD.user_id = users.user_id) BLDU on BLDU.category_id = categories.category_id) BLDUC on BLDUC.blog_id = blog_images.blog_id WHERE published=1 AND ";
	}
	else if(req.userRole == "admin"){
		getBlogs = "select * from blog_images inner join (select categories.category_details, categories.category_name, BLDU.* from categories inner join (select users.username, users.email, BLD.* from users inner join (select * from blogs inner join (select X.*, Count(comment) as commentCount from comments right outer join (select blogs.blog_id as blog_likes_id, COUNT(liked) as likeCount from blogs left outer join likes on blogs.blog_id = likes.blog_id GROUP BY blogs.blog_id) X on X.blog_likes_id = comments.blog_id GROUP by X.blog_likes_id) BL on blogs.blog_id = BL.blog_likes_id) BLD on BLD.user_id = users.user_id) BLDU on BLDU.category_id = categories.category_id) BLDUC on BLDUC.blog_id = blog_images.blog_id WHERE 1 AND ";

	}

//building the filter query
	if(Object.keys(req.query).length > 0){
// getBlogs = getBlogs + " WHERE ";
		for(var key in req.query){
			var filter = "";
			if(key == "user_id"){
				filter  = " user_id=" + req.query[key] + " AND ";
			}
			else if(key == "published" && req.userRole == "admin"){
				filter = " published=" + req.query[key] + " AND ";
			}
else if(key == "category_id"){
	filter = " category_id=" + req.query[key] + " AND ";
}
			getBlogs = getBlogs + filter;
		}

	}
	getBlogs = getBlogs + "1";

	con.query(getBlogs, function(err, data){
		if(err){
			var response = {
				"message": "Cannot show blogs",
				"errors": err
			};
			res.json(response);
		}
		else{
			res.json(data);
		}
	});
});

// ### Getting the details of a blog
// A normal user cannot get an unpublished blog
	router.route("/blogs/:blog_id")
.get(authenticate, function(req, res){
	var blog_id = req.params.blog_id;
	var getBlogDetails = "";

	if(req.userRole == "user"){
		getBlogDetails = "select * from blog_images inner join (select categories.category_details, categories.category_name, BLDU.* from categories inner join (select users.username, users.email, BLD.* from users inner join (select * from blogs inner join (select X.*, Count(comment) as commentCount from comments right outer join (select blogs.blog_id as blog_likes_id, COUNT(liked) as likeCount from blogs left outer join likes on blogs.blog_id = likes.blog_id WHERE blogs.blog_id = ? GROUP BY blogs.blog_id) X on X.blog_likes_id = comments.blog_id GROUP by X.blog_likes_id) BL on blogs.blog_id = BL.blog_likes_id) BLD on BLD.user_id = users.user_id) BLDU on BLDU.category_id = categories.category_id) BLDUC on BLDUC.blog_id = blog_images.blog_id WHERE published=1";
	}
	else{
		getBlogDetails = "select * from blog_images inner join (select categories.category_details, categories.category_name, BLDU.* from categories inner join (select users.username, users.email, BLD.* from users inner join (select * from blogs inner join (select X.*, Count(comment) as commentCount from comments right outer join (select blogs.blog_id as blog_likes_id, COUNT(liked) as likeCount from blogs left outer join likes on blogs.blog_id = likes.blog_id WHERE blogs.blog_id = ? GROUP BY blogs.blog_id) X on X.blog_likes_id = comments.blog_id GROUP by X.blog_likes_id) BL on blogs.blog_id = BL.blog_likes_id) BLD on BLD.user_id = users.user_id) BLDU on BLDU.category_id = categories.category_id) BLDUC on BLDUC.blog_id = blog_images.blog_id";
	}
	var parameters = [blog_id];
	con.query(getBlogDetails, parameters, function(err, data){
		if(err){
			var response = {
				"message": "Cannot get blog details",
				"error": err
			};
			res.status(400).json(response);
		}
		else{
			if(data.length == 0){
				var response2 = {
					"message" : "No blogs with this id"
				};
				res.status(200).json(response2);
			}
			else{
				res.status(200).json(data[0]);
			}
		}
	});
});

	router.route("/blogs/images")
.post(function(req, res){
	if(!req.query.blog_id){
		res.status(400).json({"message": "Bad request!"});
		return;
	}
	var blog_id = req.query.blog_id;
	if(!req.files){
		var addDefaultImage = "INSERT INTO blog_images SET ?";
		var data = {"blog_id": req.query.blog_id, "image_title": "default", "image_path": "images/default.jpeg"};
		con.query(addDefaultImage, data, function(err){
			if(err){
				var response = {
					"message": "Cannot add default image",
					"error": err
				};
				res.json(response);
			}
			else{
				res.status(201).json({"message": "Added default image"});
			}
		});
	}
	else{
		var extension = req.files.blogImage.name.split(".")[1];
		var image_title = md5(new Date());
		var url = "images/" +  image_title + "." + extension;
//var actual = "images/" + image_title + "_actual." + extension;
		req.files.blogImage.mv(url, function(err){
			if (err) {
				res.status(500).send(err);
			}
			else {
//resizing image into different sizes
				var url_small = "images/" + image_title + "_small." + extension;
				var url_medium = "images/" + image_title + "_medium." + extension;

				im.resize({
					srcPath: url,
					dstPath: url_small,
					width:   256
				} , function(err){
					if (err){
						//console,log(err);
					}
					else{
						//console.log("resized to fit within 256x256px");
					}
				});
				im.resize({
					srcPath: url,
					dstPath: url_medium,
					width:   512
				} , function(err){
					if (err){
						//console.log(err);
					}
					else{
						//console.log("resized to fit within 512x512px");
					}

				});
//resizing images done!

				var addImage = "INSERT INTO blog_images SET ?";
				var data = {"blog_id": blog_id, "image_title": image_title, "image_path": url, "image_path_small": url_small, "image_path_medium": url_medium};
				con.query(addImage, data, function(err){
					if(err){
						res.json(err);
					}
					else{
						res.json({"message": "Image uploaded", "path": url});
					}
				});
			}
		});
	}
});

// ### Publishing and Depublishing a blog
	router.route("/blogs/publish/:blog_id")
.post(authenticate, function(req, res){
	if(req.userRole == "user"){
		res.status(400).json({"message": "Not Aurthorized for this request!"});
		return;
	}

	var blog_id = req.params.blog_id;
	var publishBlog = "UPDATE blogs SET published = 1, published_date = NOW() WHERE blog_id = ?";
	var parameters = [blog_id];
	con.query(publishBlog, parameters, function(err){
		if(err){
			var response = {
				"message": "Cannot publish Blog",
				"error": err
			};

			res.status(400).json(response);
		}
		else{
// TODO: Solve issue of server crashing when applying these conditions
// if(data["affectedRows"] == 0){
//   res.status(400).json({"message": "No blog with this blog id", "data": data});
// }
// else{
//   res.satus(200).json({"message": "Blog Published", "data": data});
// }
			res.status(200).json({"message": "Blog Published"});
		}
	});

});

	router.route("/blogs/depublish/:blog_id")
.post(authenticate, function(req, res){
	if(req.userRole == "user"){
		req.status(400).json({"message": "Not Aurthorized for this Request"});
		return;
	}

	var blog_id = req.params.blog_id;
	var publishBlog = "UPDATE blogs SET published = 0, published_date = NOW() WHERE blog_id = ?";
	var parameters = [blog_id];
	con.query(publishBlog, parameters, function(err){
		if(err){
			var response = {
				"message": "Cannot De publish Blog",
				"error": err
			};

			res.status(400).json(response);
		}
		else{
// TODO: Solve issue of server crashing when applying these conditions
// if(data["affectedRows"] == 0){
//   res.status(400).json({"message": "No blog with this blog id", "data": data});
// }
// else{
//   res.satus(200).json({"message": "Blog Published", "data": data});
// }
			res.status(200).json({"message": "Blog Depublished"});
		}
	});
});

// Liking and Disliking a blog pot
	router.route("/blogs/like/:blog_id")
.get(authenticate, function(req, res){
	var blog_id = req.params.blog_id;
	var showLikes = "";
	if(req.userRole == "user"){
		showLikes = "SELECT users.user_id, username, email FROM users INNER JOIN likes ON users.user_id = likes.user_id WHERE blog_id = ?";
	}
	if(req.userRole == "admin"){
		showLikes = "SELECT users.user_id, username, email FROM users INNER JOIN likes ON users.user_id = likes.user_id WHERE blog_id = ?";
	}

	var parameters = [blog_id];

	con.query(showLikes, parameters, function(err, data){
		if(err){
			res.status(400).json(err);
			return;
		}

		res.status(200).json(data);

	});
})
.post(authenticate, function(req, res){
	var blog_id = req.params.blog_id;
	var user_id = req.userId;
	var addLike = "INSERT INTO likes SET ?";
	var parameters = [{"user_id": user_id, "blog_id": blog_id, "liked": 1}];
	con.query(addLike, parameters, function(err){
		if(err){
			res.status(400).json(err);
			return;
		}

		var response = {
			"message": "Successfully liked the blog"
		};
		res.status(201).json(response);

	});
})

.delete(authenticate, function(req, res){
	var blog_id = req.params.blog_id;
	var user_id = req.userId;
	var removeLike = "DELETE FROM likes WHERE user_id = ? AND blog_id = ?";
//var removeLike = "UPDATE likes SET ? WHERE user_id = ? AND blog_id = ?";
	var parameters = [user_id, blog_id];
	con.query(removeLike, parameters, function(err){
		if(err){
			var response = {
				"message": "Cannot remove like",
				"error": err
			};
			res.status(400).json(response);
			return;
		}

		var response2 = {
			"message": "Successfully Removed Like"
		};
		res.status(200).json(response2);

	});
});

	router.route("/blogs/comment/:blog_id")
.get(authenticate, function(req, res){
	var blog_id = req.params.blog_id;
	var showLikes = "";
	if(req.userRole == "user"){
		showLikes = "SELECT users.user_id, username, email, comment_id, comment FROM users INNER JOIN comments ON users.user_id = comments.user_id WHERE blog_id = ?";
	}
	if(req.userRole == "admin"){
		showLikes = "SELECT users.user_id, username, email, comment_id, comment FROM users INNER JOIN comments ON users.user_id = comments.user_id WHERE blog_id = ?";
	}

	var parameters = [blog_id];

	con.query(showLikes, parameters, function(err, data){
		if(err){
			res.status(400).json(err);
			return;
		}

		res.status(200).json(data);

	});
})
.post(authenticate, function(req, res){
	if(!req.body.comment){
		var response = {
			"message": "Request Format Error",
			"required": {
				"comment": "comment of the user"
			}
		};
		res.status(400).json(response);
		return;
	}
	var blog_id = req.params.blog_id;
	var user_id = req.userId;
	var addLike = "INSERT INTO comments SET ?";
	var parameters = [{"user_id": user_id, "blog_id": blog_id, "comment": req.body.comment}];
	con.query(addLike, parameters, function(err){
		if(err){
			res.status(400).json(err);
			return;
		}

		var response = {
			"message": "Successfully added Comment on the blog"
		};
		res.status(201).json(response);

	});
})

.delete(authenticate, function(req, res){
	if(!req.body.comment_id){
		var response = {
			"message": "Request Format Error",
			"required": {
				"comment_id": "id of the comment"
			}
		};

		res.status(400).json(response);
		return;
	}

	var removeLike = "DELETE FROM comments WHERE comment_id = ?";
	var parameters = [req.body.comment_id];
	con.query(removeLike, parameters, function(err){
		if(err){
			var response = {
				"message": "Cannot remove comment",
				"error": err
			};
			res.status(400).json(response);
			return;
		}

		var response2 = {
			"message": "Successfully Removed Comment"
		};
		res.status(200).json(response2);

	});
});

	router.route("/migration")
.post(function(req, res){
	var q = "select * from blog_images";
	con.query(q, function(err, data){
		for(var i=0; i < data.length; i++){
			var value = data[i];
			var url = value.image_path;
			var image_name = url.split(".")[0];
			var extension = url.split(".")[1];
//resizing image into different sizes
			var url_small = image_name + "_small." + extension;
			var url_medium = image_name + "_medium." + extension;

			im.resize({
				srcPath: url,
				dstPath: url_small,
				width:   256
			} , function(err){
				if (err){
					//console.log(err);
				}
				else{
					//console.log("resized to fit within 256x256px");
				}
			});
			im.resize({
				srcPath: url,
				dstPath: url_medium,
				width:   512
			} , function(err){
				if (err){
					//console.log(err);
				}
				else{
					//console.log("resized to fit within 512x512px");
				}

			});
//resizing images done!

			var insertQ = "UPDATE blog_images SET ? WHERE image_path = ?";
			var para = [{"image_path_small": url_small, "image_path_medium": url_medium}, url];
			con.query(insertQ, para, function(err){
				if(err)
					res.json(err);
				return;

			});

		}
		res.json("kam hogaya!");
	});
});
};
