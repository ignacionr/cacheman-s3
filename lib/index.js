var AWS = require('aws-sdk');
var minimatch = require("minimatch");

var set = function(key, data, ttl, fn) {
    if ('function' === typeof ttl) {
      fn = ttl;
      ttl = null;
    }

    var val;
    try {
      val = JSON.stringify(data);
    } catch (e) {
      return fn(e);
    }
    var setParams = {
      Bucket    : this.bucket,
      Key       : key,
      Body      : val
    };
    
    if (ttl && ttl >= 0) {
      setParams.Expires = new Date(new Date().getTime() + ttl * 1000).toISOString();
    }
    
    this.client.putObject(setParams, function(err,data) {
      if (err) return fn(err);
      fn(null, data);
    });
  };

var get = function (key, fn) {
  this.client.getObject({
    Bucket    : this.bucket,
    Key       : key
  }, function(err,data) {
    if (err) {
      if (err.code === "NoSuchKey") {
        return fn(null,null);
      }
      else {
        return fn(err);
      }
    }
    if (data.Expires) {
      if (new Date(data.Expires).getTime() < new Date().getTime()) {
        // this item is expired, don't use it
        fn(null,null);
      }
    }
    return fn(null, JSON.parse(data.Body));
  });
};

var delGlob = function(ctx, key,fn) {
  var prefixLen = key.indexOf('*');
  var prefix = key.substr(0, prefixLen);
  ctx.client.listObjects({
    Bucket    : ctx.bucket,
    Prefix    : prefix
  }, function(err,data) {
    var test = minimatch.makeRe(key);
    var toDelete = [];
    for(var contentKey in data.Contents) {
      var k = data.Contents[contentKey].Key;
      if (test.test(k)) {
        toDelete.push({Key: k});
      }
    }
    if (toDelete.length > 0) {
      ctx.client.deleteObjects({
        Bucket      : ctx.bucket,
        Delete      : {Objects: toDelete}
      }, fn);
    }
    else {
      fn(null,null);
    }
  });
};

var del = function (key, fn) {
  if (key.includes('*')) {
    delGlob(this, key,fn);
  }
  else {
    this.client.deleteObject({
      Bucket    : this.bucket,
      Key       : key
    }, function(err,data) {
      if (err) return fn(err);
      fn(null, data);
    });
  }
};

var clear = function(fn) {
  delGlob(this, '*', fn);
};

var CachemanS3 = function(options) {
    options = options || {};
    options.bucket = options.bucket || "cacheman";
    var cli = new AWS.S3();
    cli.createBucket({Bucket: options.bucket}, function(){});
    return {
        version         : "1.0.1",
        bucket          : options.bucket,
        client          : cli,
        set             : set,
        get             : get,
        del             : del,
        clear           : clear
    };
};

module.exports = CachemanS3;