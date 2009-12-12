/**
 * @class Chat dialog
 */
RPG.UI.Chat = OZ.Class();

RPG.UI.Chat.prototype.init = function(chat, action) {
	this._current = chat;
	this._action = action;
	this._showPart(chat);
}

RPG.UI.Chat.prototype._showPart = function(chat) {
	var text = chat.getText();
	var options = chat.getOptions();
	var result = null;
	var num = null;
	
	if (options.length) {
		var str = text;
		str += "\n\n";
		for (var i=0;i<options.length;i++) {
			var o = options[i];
			str += (i+1)+". " + o[0] + "\n";
		}
		do {
			/* ask for option until valid answer comes */
			result = prompt(str);
			if (result === null) { break; }
			num = parseInt(result, 10);
		} while (isNaN(num) || num <= 0 || num > options.length);
	} else {
		var s = RPG.Misc.format('"%s"', text);
		RPG.UI.buffer.message(s);
	}
	
	if (result) {
		var o = options[num-1];
		var todo = o[1];
		if (todo instanceof RPG.Misc.Chat) {
			this._showPart(todo);
		} else if (todo) {
			todo(this._action);
		}
	} else {
		/* end of conversation; execute end if any */
		var end = this._current.getEnd();
		if (end) { end(this._action); }
	}
	
	RPG.UI.setMode(RPG.UI_NORMAL);
}
