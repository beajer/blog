let p = Promise.resolve()
p.then(() => console.log(1))
console.log(3)
p.then(() => console.log(2))