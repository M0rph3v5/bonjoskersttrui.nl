var util = require('util');

var bleno = require('bleno');

var BlenoCharacteristic = bleno.Characteristic;

var AnimationCharacteristic = function(changeCallback) {
  AnimationCharacteristic.super_.call(this, {
    uuid: '0aab64f8-2500-4004-8f81-19cca43ddc4d',
    properties: ['write'],
    value: null
  });

  this._value = new Buffer(0);
  this._callback = changeCallback;
};
util.inherits(AnimationCharacteristic, BlenoCharacteristic);

AnimationCharacteristic.prototype.onWriteRequest = function(data, offset, withoutResponse, callback) {
  this._value = new Uint8Array(data);
  console.log('AnimationCharacteristic - onWriteRequest: value = ' + this._value);
  this._callback(this._value[0]);
  callback(this.RESULT_SUCCESS);
};

module.exports.Animation = AnimationCharacteristic;

var BrightnessCharacteristic = function(changeCallback) {
  BrightnessCharacteristic.super_.call(this, {
    uuid: 'da4bb95e-a373-4ded-889d-cbb4188b6d46',
    properties: ['write'],
    value: null
  });

  this._value = new Buffer(0);
  this._callback = changeCallback;
};
util.inherits(BrightnessCharacteristic, BlenoCharacteristic);

BrightnessCharacteristic.prototype.onWriteRequest = function(data, offset, withoutResponse, callback) {
  this._value = new Uint8Array(data);
  console.log('BrightnessCharacteristic - onWriteRequest: value = ' + this._value);
  this._callback(this._value[0]);
  callback(this.RESULT_SUCCESS);
};

module.exports.Brightness = BrightnessCharacteristic;

var WordCharacteristic = function(changeCallback) {
  WordCharacteristic.super_.call(this, {
    uuid: 'de2d34c0-8c70-4f6c-9daa-8a0484736c20',
    properties: ['write'],
    value: null
  });

  this._value = new Buffer(0);
  this._callback = changeCallback;
};
util.inherits(WordCharacteristic, BlenoCharacteristic);

WordCharacteristic.prototype.onWriteRequest = function(data, offset, withoutResponse, callback) {
  this._value = data.toString('utf8');
  console.log('WordCharacteristic - onWriteRequest: value = ' + this._value);
  this._callback(this._value);
  callback(this.RESULT_SUCCESS);
};

module.exports.Word = WordCharacteristic;
