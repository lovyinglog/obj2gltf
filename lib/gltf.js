'use strict';
var Cesium = require('cesium');
var Promise = require('bluebird');
var fsExtra = require('fs-extra');
var path = require('path');

var fsExtraWriteFile = Promise.promisify(fsExtra.writeFile);

var defined = Cesium.defined;
var defaultValue = Cesium.defaultValue;
var WebGLConstants = Cesium.WebGLConstants;

module.exports = createGltf;

var sizeOfFloat32 = 4;
var sizeOfUint32 = 4;
var sizeOfUint16 = 2;

function createGltf(gltfPath, objData) {
    var nodes = objData.nodes;
    var materials = objData.materials;
    var images = objData.images;

    var usedIds = {};
    function getId(id) {
        var occurrences = usedIds[id];
        if (defined(occurrences)) {
            id = id + '_' + occurrences;
            usedIds[id]++;
        } else {
            usedIds[id] = 1;
        }
        return id;
    }

    var sceneId = getId('scene');

    var gltf = {
        accessors : {},
        asset : {},
        buffers : {},
        bufferViews : {},
        images : {},
        materials : {},
        meshes : {},
        nodes : {},
        samplers : {},
        scene : sceneId,
        scenes : {},
        textures : {}
    };

    gltf.asset = {
        generator : 'obj2gltf',
        profile : {
            api : 'WebGL',
            version : '1.0.2'
        },
        version: '1.1'
    };

    gltf.scenes[sceneId] = {
        nodes : []
    };

    var samplerId = getId('sampler');
    gltf.samplers[samplerId] = {
        magFilter : WebGLConstants.LINEAR,
        minFilter : WebGLConstants.NEAREST,
        wrapS : WebGLConstants.CLAMP_TO_EDGE,
        wrapT : WebGLConstants.CLAMP_TO_EDGE
    };

    function getImageId(imagePath) {
        return getId(path.basename(imagePath, path.extname(imagePath)));
    }

    function getTextureId(imagePath) {
        if (!defined(imagePath)) {
            return undefined;
        }
        return getId('texture_' + getImageId(imagePath));
    }

    for (var materialId in materials) {
        if (materials.hasOwnProperty(materialId)) {
            var material = materials[materialId];
            var ambient = defaultValue(defaultValue(getTextureId(material.ambientColorMap), material.ambientColor), [0, 0, 0, 1]);
            var diffuse = defaultValue(defaultValue(getTextureId(material.diffuseColorMap), material.diffuseColor), [0.5, 0.5, 0.5, 1]);
            var emission = defaultValue(defaultValue(getTextureId(material.emissionColorMap), material.emissionColor), [0, 0, 0, 1]);
            var specular = defaultValue(defaultValue(getTextureId(material.specularColorMap), material.specularColor), [0, 0, 0, 1]);
            var shininess = defaultValue(material.specularShininess, 0.0);
            var hasSpecular = (shininess > 0.0) && (specular[0] > 0.0 || specular[1] > 0.0 || specular[2] > 0.0);
            var technique = hasSpecular ? 'PHONG' : 'LAMBERT';
            gltf.materials[materialId] = {
                name : materialId,
                extensions : {
                    KHR_materials_common : {
                        technique : technique,
                        values : {
                            ambient : ambient,
                            diffuse : diffuse,
                            emission : emission,
                            specular : specular,
                            shininess : shininess
                        }
                    }
                }
            };
        }
    }

    for (var imagePath in images) {
        if (images.hasOwnProperty(imagePath)) {
            var image = images[imagePath];
            var imageId = getImageId(imagePath);
            var textureId = getTextureId(imagePath);

            gltf.images[imageId] = {
                name : imageId,
                uri : image.uri
            };
            gltf.textures[textureId] = {
                format : image.format,
                internalFormat : image.format,
                sampler : samplerId,
                source : imageId,
                target : WebGLConstants.TEXTURE_2D,
                type : WebGLConstants.UNSIGNED_BYTE
            };
        }
    }

    var bufferId = 'buffer';
    var vertexBufferViewId = 'bufferView_vertex';
    var indexBufferViewId = 'bufferView_index';

    var vertexByteOffset = 0;
    var indexByteOffset = 0;
    var vertexBuffers = [];
    var indexBuffers = [];

    function addVertexAttribute(array, components) {
        var length = array.length;
        if (length === 0) {
            return;
        }

        var min = new Array(components).fill(Number.POSITIVE_INFINITY);
        var max = new Array(components).fill(Number.NEGATIVE_INFINITY);
        var buffer = Buffer.alloc(length * sizeOfFloat32);
        var count = length / components;
        for (var i = 0; i < count; ++i) {
            for (var j = 0; j < components; ++j) {
                var index = count * components + j;
                var value = array[index];
                min[j] = Math.min(min[j], value);
                max[j] = Math.max(max[j], value);
                buffer.writeFloatLE(value, index * sizeOfFloat32);
            }
        }

        var type = (components === 3 ? 'VEC3' : 'VEC2');
        var accessor = {
            bufferView : vertexBufferViewId,
            byteOffset : vertexByteOffset,
            byteStride : 0,
            componentType : WebGLConstants.FLOAT,
            count : count,
            min : min,
            max : max,
            type : type
        };

        vertexByteOffset += buffer.length;
        vertexBuffers.push(buffer);
        var accessorId = getId('accessor');
        gltf.accessors[accessorId] = accessor;
        return accessorId;
    }

    function addIndexArray(array) {
        var i;
        var length = array.length;
        var min = Number.POSITIVE_INFINITY;
        var max = Number.NEGATIVE_INFINITY;
        for (i = 0; i < length; ++i) {
            var value = array[i];
            min = Math.min(min, value);
            max = Math.max(max, value);
        }

        var componentType;
        var buffer;

        if (max < 65535) {
            // Reserve the 65535 index for primitive restart
            componentType = WebGLConstants.UNSIGNED_SHORT;
            buffer = Buffer.alloc(length * sizeOfUint16);
            for (i = 0; i < length; ++i) {
                buffer.writeUInt16LE(array[j], j * sizeOfUint16);
            }
        } else {
            componentType = WebGLConstants.UNSIGNED_INT;
            buffer = Buffer.alloc(length * sizeOfUint32);
            for (i = 0; i < length; ++i) {
                buffer.writeUInt32LE(array[j], j * sizeOfUint32);
            }
        }

        var accessor = {
            bufferView : indexBufferViewId,
            byteOffset : indexByteOffset,
            byteStride : 0,
            componentType : componentType,
            count : length,
            min : [min],
            max : [max],
            type : 'SCALAR'
        };

        indexByteOffset += buffer.length;
        indexBuffers.push(buffer);
        var accessorId = getId('accessor');
        gltf.accessors[accessorId] = accessor;
        return accessorId;
    }

    var gltfSceneNodes = gltf.scenes[sceneId].nodes;
    var nodesLength = nodes.length;
    for (var i = 0; i < nodesLength; ++i) {
        // Add node
        var node = nodes[i];
        var nodeId = node.name;
        gltfSceneNodes.push(nodeId);
        var gltfNodeMeshes = [];
        gltf.nodes[nodeId] = {
            name : nodeId,
            meshes : gltfNodeMeshes
        };

        // Add meshes to node
        var meshes = node.meshes;
        var meshesLength = meshes.length;
        for (var j = 0; j < meshesLength; ++j) {
            var mesh = meshes[j];
            var meshId = mesh.name;
            gltfNodeMeshes.push(meshId);

            var positionAccessorId = addVertexAttribute(mesh.positions);
            var normalAccessorId = addVertexAttribute(mesh.normals);
            var uvAccessorId = addVertexAttribute(mesh.uvs);

            var attributes = {
                POSITION : positionAccessorId,
                NORMAL : normalAccessorId,
                TEXCOORD_0 : uvAccessorId
            };

            var gltfMeshPrimitives = [];
            gltf.meshes[meshId] = {
                name : meshId,
                primitives : gltfMeshPrimitives
            };

            // Add primitives to mesh
            var primitives = mesh.primitives;
            var primitivesLength = primitives.length;
            for (i = 0; i < primitivesLength; ++i) {
                var primitive = primitives[i];
                var indexAccessorId = addIndexArray(primitive.indices);
                gltfMeshPrimitives.push({
                    attributes : attributes,
                    indices : indexAccessorId,
                    material : primitive.material,
                    mode : WebGLConstants.TRIANGLES
                });
            }
        }
    }

    var vertexBuffer = Buffer.concat(vertexBuffers);
    var indexBuffer = Buffer.concat(indexBuffers);
    var buffer = Buffer.concat([vertexBuffer, indexBuffer]);

    var testBuffer = Buffer.alloc(300000000);
    var testuri = buffer.toString(testBuffer);

    //var testuri = 'data:application/octet-stream;base64,' + buffer.toString('base64');
    console.log(testuri === '2');
    // var bufferSeparate = false;
    // var bufferUri;
    // if (buffer.length > 201326580) {
    //     // TODO : check if this is true with different toString type functions
    //     // toString fails for buffers larger than ~192MB. Instead save the buffer to a .bin file.
    //     // Source: https://github.com/nodejs/node/issues/4266
    //     bufferSeparate = true;
    //     bufferUri = modelName + '.bin';
    // } else {
    //     bufferUri = 'data:application/octet-stream;base64,' + buffer.toString('base64');
    // }


    gltf.buffers[bufferId] = {
        byteLength : buffer.byteLength,
        type : 'arraybuffer',
        uri : bufferUri
    };

    gltf.bufferViews[vertexBufferViewId] = {
        buffer : bufferId,
        byteLength : vertexBuffer.length,
        byteOffset : 0,
        target : WebGLConstants.ARRAY_BUFFER
    };

    gltf.bufferViews[indexBufferViewId] = {
        buffer : bufferId,
        byteLength : indexBuffer.length,
        byteOffset : vertexBuffer.length,
        target : WebGLConstants.ELEMENT_ARRAY_BUFFER
    };


    // if (bufferSeparate) {
    //     return getId(path.basename(imagePath, path.extname(imagePath)));
    //
    //     var bufferPath = path.join(inputPath, modelName + '.bin');
    //     return fsWriteFile(bufferPath, buffer);
    // }
    return gltf;
}
