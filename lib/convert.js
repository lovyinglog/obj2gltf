'use strict';
var Cesium = require('cesium');
var GltfPipeline = require('gltf-pipeline').Pipeline;
var path = require('path');
var createGltf = require('./gltf');
var loadObj = require('./obj');

var defined = Cesium.defined;
var defaultValue = Cesium.defaultValue;

module.exports = convert;

function convert(objPath, gltfPath, options) {
    options = defaultValue(options, defaultValue.EMPTY_OBJECT);
    var binary = defaultValue(options.binary, false);
    var embed = defaultValue(options.embed, true);
    var embedImage = defaultValue(options.embedImage, true);
    var compress = defaultValue(options.compress, false);
    var ao = defaultValue(options.ao, false);
    var optimizeForCesium = defaultValue(options.optimizeForCesium, false);

    if (!defined(objPath)) {
        throw new Error('objPath is required');
    }

    if (!defined(gltfPath)) {
        throw new Error('gltfPath is required');
    }

    var modelName = path.basename(objPath, path.extname(objPath));
    var extension = path.extname(gltfPath);
    if (extension === '.glb') {
        binary = true;
    }
    gltfPath = path.join(path.dirname(gltfPath), modelName + extension);

    var aoOptions;
    if (ao) {
        aoOptions = {
            enable : true
        };
    }

    var pipelineOptions = {
        binary : binary,
        embed : embed,
        embedImage : embedImage,
        encodeNormals : compress,
        quantize : compress,
        compressTextureCoordinates : compress,
        aoOptions : aoOptions,
        optimizeForCesium : optimizeForCesium,
        createDirectory : false,
        basePath : path.dirname(objPath)
    };

    return loadObj(objPath)
        .then(function(objData) {
            return createGltf(gltfPath, objData);
        })
        .then(function(gltf) {
            return GltfPipeline.processJSONToDisk(gltf, gltfPath, pipelineOptions);
        });
}
