var three = require('three');
var extend = require('extend-shallow');
function BatchChildMesh(mesh, batchMesh) {
    this.mesh = mesh;
    this.batchMesh = batchMesh;
    this.itemRange = mesh.geometry.attributes[Object.keys(mesh.geometry.attributes)[0]].count;
    this.itemOffset = batchMesh.generateOffset(this);

    this.lastPosition = new three.Vector3();
    this.lastQuaternion = new three.Quaternion();
    this.lastScale = new three.Vector3();

    this.dirtyAttributes = {
        position: false,
        normal: false,
        uv: false
    }
}

function markChangesDirty() {
    this.positionChanged = !this.lastPosition.equals(this.mesh.position);
    this.quaternionChanged = !this.lastQuaternion.equals(this.mesh.quaternion);
    this.scaleChanged = !this.lastScale.equals(this.mesh.scale);

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