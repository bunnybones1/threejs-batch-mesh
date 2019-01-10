var three = require('three');
var extend = require('extend-shallow');
function BatchChildMesh(mesh, batchMesh) {
    this.mesh = mesh;
    this.batchMesh = batchMesh;
    this.itemRange = mesh.geometry.attributes[Object.keys(mesh.geometry.attributes)[0]].count;
    this.itemOffset = batchMesh.generateOffset(this);

    this.lastPosition = new three.Vector3(-9999, -9999, -9999);
    this.lastQuaternion = new three.Quaternion();
    this.lastScale = new three.Vector3();

    this.dirtyAttributes = {
        position: false,
        normal: false,
        uv: false,
        uv2: false
    }
}

var epPos = 0.0001;
var epRot = 0.001;
var epScale = 0.001;
function manhattanDistanceTo(v) {
    return Math.abs( this.x - v.x ) + Math.abs( this.y - v.y ) + Math.abs( this.z - v.z ) + Math.abs( this.w - v.w );
}
function markChangesDirty() {
    this.positionChanged = this.lastPosition.manhattanDistanceTo(this.mesh.position) > epPos;
    this.quaternionChanged = manhattanDistanceTo.call(this.lastQuaternion, this.mesh.quaternion) > epRot;
    this.scaleChanged = this.lastScale.manhattanDistanceTo(this.mesh.scale) > epScale;

    if(!(this.positionChanged || this.quaternionChanged || this.scaleChanged)) return;

    if(this.positionChanged || this.quaternionChanged || this.scaleChanged) this.dirtyAttributes.position = true;
    if(this.quaternionChanged) this.dirtyAttributes.normal = true;

    this.lastPosition.copy(this.mesh.position);
    this.lastQuaternion.copy(this.mesh.quaternion);
    this.lastScale.copy(this.mesh.scale);
}

extend(BatchChildMesh.prototype, {
    markChangesDirty
});

module.exports = BatchChildMesh;