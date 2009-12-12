/**
 * @class Story class
 */
RPG.Story = OZ.Class();

RPG.Story.prototype.init = function() {
	RPG.UI.sound = new RPG.UI.Sound();
	RPG.UI.sound.preloadBackground("de1m1");
	this._maxDepth = 6;
	this._maps = [];
	this._name = OZ.DOM.elm("input", {type:"text", size:"15", font:"inherit", value: "Hero"});
//	this._chat = this._buildChat();
	this._mapgen = new RPG.Generators.Digger(new RPG.Misc.Coords(60, 20));

	OZ.Event.add(RPG.World, "action", this.bind(this._action));
}

RPG.Story.prototype.go = function() {
	var cg = new RPG.CharGen();

	var w = OZ.DOM.win()[0];
	var d = OZ.DOM.elm("div", {width:Math.round(w/2) + "px"});
	var p1 = OZ.DOM.elm("p");
	p1.innerHTML = "You are about to dive into the depths of a dungeon. "
					+ "Your task is to venture into the lowest level, retrieve as much "
					+ "valuables as possible and safely return to the surface.";
	var p2 = OZ.DOM.elm("p", {className: "name"});
	p2.innerHTML = "Your name: ";
	p2.appendChild(this._name);

	OZ.DOM.append([d, p1, p2, cg.build()]);
	RPG.UI.showDialog(d, "Welcome, adventurer!");
	
	OZ.Event.add(cg, "chargen", this.bind(this._charGen));
}

RPG.Story.prototype._action = function(e) {
	var a = e.data;
	if (!(a instanceof RPG.Actions.Death)) { return; }
	if (a.getSource() == this._pc) { this._endGame(); }
}

RPG.Story.prototype._charGen = function(e) {
	if (!this._name.value) {
		this._name.focus();
		return;
	}
	
	RPG.UI.hideDialog();
	
	var race = e.data.race;
	var profession = e.data.profession;
	
	RPG.UI.build();
	this._pc = this._createPC(race, profession, this._name.value);
	
	var map = this._firstMap();
	map.use();
	RPG.World.addActor(this._pc);
	var cell = map.getFeatures(RPG.Features.Staircase.Up)[0].getCell();
	
	RPG.UI.sound.playBackground();
	RPG.World.action(new RPG.Actions.Move(this._pc, cell));
}

RPG.Story.prototype._createPC = function(race, profession, name) {
	var pc = new RPG.Beings.PC(new race(), new profession());
	RPG.World.pc = pc;
	RPG.World.setStory(this);
	pc.setName(name);

	var tmp = new RPG.Items.HealingPotion();
	pc.addItem(tmp);

	var tmp = new RPG.Items.IronRation();
	pc.addItem(tmp);
	
	var tmp = new RPG.Items.Torch();
	pc.addItem(tmp);

	return pc;
}

RPG.Story.prototype._score = function() {
	var total = 0;
	
	total += 150 * this._maps.length;
	total += 20 * this._pc.getKills();
	
	var items = this._pc.getItems();
	for (var i=0;i<items.length;i++) {
		var item = items[i];
		if (item instanceof RPG.Items.Gold) { total += item.getAmount(); }
		if (item instanceof RPG.Items.Gem) { total += 100; }
	}
	
	if (this._pc.isAlive()) {
		total = total * 2;
	}
	
	return total;
}

RPG.Story.prototype._endGame = function() {
	RPG.World.lock();
	var div = OZ.DOM.elm("div");
	var p1 = OZ.DOM.elm("p");
	
	var str = this._pc.getName();
	if (this._pc.isAlive()) {
		str += " managed to finish the game alive!";
	} else {
		str += " was unable to surive in the dangerous dungeon.";
	}
	p1.innerHTML = str;
	
	var score = this._score();
	var p2 = OZ.DOM.elm("p");
	p2.innerHTML = "He managed to kill <strong>" + this._pc.getKills() + "</strong> monsters and his total score was: <strong>" + score + "</strong>";
	
	var p3 = OZ.DOM.elm("p");
	p3.innerHTML = "<a href='javascript:location.reload()'>Again?</a>";

	OZ.DOM.append([div, p1, p2, p3]);
	RPG.UI.showDialog(div, "Game over");
}

RPG.Story.prototype._randomDungeon = function() {
	var index = this._maps.length;
	
	var rooms = [];
	var map = null;
	do {
		map = this._mapgen.generate("Dungeon #" + index, index + 1);
		rooms = map.getRooms();
	} while (rooms.length < 3);

	RPG.Decorators.Hidden.getInstance().decorate(map, 0.01)	
	var arr = [];

	for (var i=0;i<rooms.length;i++) { 
		RPG.Decorators.Doors.getInstance().decorate(map, rooms[i]);
		arr.push(rooms[i]);
	}
	
	/* enemies */
	var max = 4 + Math.floor(Math.random()*6);
	RPG.Decorators.Beings.getInstance().decorate(map, max);
	
	/* items */
	var max = 2 + Math.floor(Math.random()*4);
	RPG.Decorators.Items.getInstance().decorate(map, max);

	/* traps */
	var max = 1 + Math.floor(Math.random()*2);
	RPG.Decorators.Traps.getInstance().decorate(map, max);

	/* stairs up */
	var roomUp = arr.random();
	var index = arr.indexOf(roomUp);
	arr.splice(index, 1);
	var up = new RPG.Features.Staircase.Up();
	map.at(roomUp.getCenter()).setFeature(up);
	
	/* bind to previous dungeon */
	if (this._maps.length) {
		var prev = this._maps[this._maps.length-1];
		this._attachPrevious(map, prev);
	}
	
	/* stairs down */
	if (this._maps.length + 1 < this._maxDepth) {
		var roomDown = arr.random();
		var index = arr.indexOf(roomDown);
		arr.splice(index, 1);
		var down = new RPG.Features.Staircase.Down();
		map.at(roomDown.getCenter()).setFeature(down);
		this._attachNext(map);
	} else {
		/* last level */

		/* treasure */
		var roomTreasure = arr.random();
		var index = arr.indexOf(roomTreasure);
		arr.splice(index, 1);
		RPG.Decorators.Doors.getInstance().decorate(map, roomTreasure, {locked: 1});
		RPG.Decorators.Treasure.getInstance().decorate(map, roomTreasure, {treasure: 1});

		var troll = new RPG.Beings.Troll();
		troll.setName("Chleba");
		map.at(roomTreasure.getCenter()).setBeing(troll);
	}
	
	/* artifact */
	if (this._maps.length + 2 == this._maxDepth) {
		var cell = map.getFreeCell(true);
		var tmp = new RPG.Items.KlingonSword();
		var trap = new RPG.Features.Trap.Teleport();
		cell.setFeature(trap);
		cell.addItem(tmp);
	}

	this._maps.push(map);
	return map;
}
	
/**
 * Staircase needs its target dungeon generated
 */
RPG.Story.prototype._down = function(staircase) {
	var map = this._randomDungeon();
	var up = map.getFeatures(RPG.Features.Staircase.Up)[0];
	return up.getCell();
}

RPG.Story.prototype._firstMap = function() {
//	var map = this._randomDungeon();

    var mapgen = new RPG.Generators.Village();
    var map = mapgen.generate("A small village");
	this._attachNext(map);
	
	this._attachGameover(map);
	this._maps.push(map);
	return map;
}

RPG.Story.prototype._attachGameover = function(map) {
	var up = map.getFeatures(RPG.Features.Staircase.Up)[0];
	up.setTarget(this.bind(this._endGame));
}

RPG.Story.prototype._attachNext = function(map) {
	var down = map.getFeatures(RPG.Features.Staircase.Down)[0];
	down.setTarget(this.bind(this._down));
}
	
RPG.Story.prototype._attachPrevious = function(map, previousMap) {
	var down = previousMap.getFeatures(RPG.Features.Staircase.Down)[0];
	var up = map.getFeatures(RPG.Features.Staircase.Up)[0];

	up.setTarget(down.getCell());
}
/*
RPG.Story.prototype._buildChat = function() {
	var c = new RPG.Misc.Chat("Hi, what am I supposed to do?")
		.addOption("Nothing special")
		.addOption("Some activity please", new RPG.Misc.Chat("What activity?")
			.addOption("Kill me!", function(action) {
				action.getTarget().clearTasks();
				action.getTarget().addTask(new RPG.Engine.AI.Kill(action.getSource()));
			})
			.addOption("Attack me!", function(action) {
				action.getTarget().clearTasks();
				action.getTarget().addTask(new RPG.Engine.AI.Attack(action.getSource()));
			})
			.addOption("Run away!", function(action) {
				action.getTarget().clearTasks();
				action.getTarget().addTask(new RPG.Engine.AI.Retreat(action.getSource()));
			})
		);
	return c;
}
*/
