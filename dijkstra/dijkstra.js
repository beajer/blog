const data = [
		{
			node: 'S',
			next: [{
					node: 'a',
					weight: 5
				},{
					node: 'b',
					weight: 2
				}]
		},{
			node: 'a',
			next: [{
					node: 'c',
					weight: 4
				},{
					node: 'd',
					weight: 2
				}]	
		},{
			node: 'b',
			next: [{
				node: 'a',
				weight: 8
			},{
				node: 'd',
				weight: 7
			}]
		},{
			node: 'c',
			next: [{
					node: 'd',
					weight: 6
				},{
					node: 'E',
					weight: 1
				}]
		},{
			node: 'd',
			next: [{
				node: 'E',
				weight: 1
			}]
		},{
			node: 'E',
			next: []
		}
	]

/*
cost : {
	a: {
		path: ['S', 'a'],
		weigth: 5
	}
	...
}
*/

class PathInfo {
	constructor(path=[], weight=0){
		this.path = path
		this.weight = weight
	}
}

class Dijkstra{	
	constructor(map=[]){
		this.map = map
	}
	_findNode(start){
		return this.map.find(item => item.node === start)
	}
	fsp(start, end){
		let processed = new Set()
		let cost = Object.create(null)
		//应该维持一个任务node队列
		let queueNode = []
		
		let shortestPath = Infinity
    
		function _updateCost(start, prev){
			let pathinfo = new PathInfo()
			pathinfo.path = prev ? cost[pre.node].path.concat(start.node): [start.node]
			pathinfo.weight = (prev ? cost[pre.node].weight : 0) + (start.weight || 0)

		}

		function travel(start, prev={}){
			let currentWeight = (start.weight || 0) + (prev ? prev.weight : 0)
			let recordWeight = cost[start.node].weigth || 0
      if(processed.has(start.node) && currentWeight > recordWeight){
      	return 
      }else{
      	processed.add(start.node)
      }
      _updateCost(start, prev)
      cost[start.node] = currentWeight
			if(Number.isFinite(shortestPath) && currentWeight > shortestPath) return
			if(start.next.length == 0) return
			start.next.forEach(row=>{

			})
		}
	}
}

let di = new Dijkstra(data)
