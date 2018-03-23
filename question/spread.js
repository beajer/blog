var a = {
	k: {
		b: '1'
	}
}

两者都会互相关联
var b = a 
a == b // true
//指向同一个内存地址

var c = {..a}
a == c // false
//proxy?
