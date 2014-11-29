var MD5 = require('MD5');
var crypto = require('crypto');

module.exports = {
    md5: function (data) {
      return crypto.createHash('md5').update(data).digest('hex');
    },

    md5sum: function (data) {
      return MD5(data).toString();
    },

    weak32: function (data, prev, start, end) {
      
      var a = 0;
      var b = 0;
      var M = 1 << 16;
      var N = 65521;

      if (!prev) {
        var len = (start >= 0 && end >= 0) ? (end - start + 1) : data.length;
        var datai;
        for (var i = 0; i < len; i++) {
          datai = data[i];
          a += datai;
          b += ((len - i) * datai);
        }

        a %= N;
        b %= N;
      } else {
        var k = start;
        var l = end - 1;
        var prev_k = k - 1;
        var prev_l = l - 1;
        var prev_first = data[prev_k];
        var curr_last = data[l];

        a = (prev.a - prev_first + curr_last) % N;
        b = (prev.b - (prev_l - prev_k + 1) * prev_first + a) % N;
      }
      return { a: a, b: b, sum: a + b * M };
      
    },

    weak16: function (data) {
      return 0xffff & (data >> 16 ^ data * 1009);
    }
};