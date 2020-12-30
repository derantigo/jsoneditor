import Ajv from 'ajv'
import { parseJSONPointerWithArrayIndices } from '../utils/jsonPointer.js'

/**
 * Create a JSON Schema validator powered by Ajv.
 * @param {JSON} schema
 * @param {Object} [schemaRefs=undefined]  An object containing JSON Schema references
 * @return {function (doc: JSON) : Array<Object>} Returns a valiation function
 */
export function createAjvValidator (schema, schemaRefs) {
  // FIXME: to get Ajv loaded correctly, we need the following trick, and also,
  //  in the file ajv/dist/compile/validate/iterate.js we need to replace dataType_2 usages and definition with dataType_1
  //  see https://github.com/rollup/plugins/issues/745
  const ajv = new (Ajv.default || Ajv)({
    strict: false,
    allErrors: true,
    verbose: true,
    $data: true
  })

  if (schemaRefs) {
    Object.keys(schemaRefs).forEach(ref => {
      ajv.addSchema(schemaRefs[ref], ref)
    })
  }

  const validateAjv = ajv.compile(schema)

  return function validate (doc) {
    validateAjv(doc)
    const ajvErrors = validateAjv.errors || []

    return ajvErrors
      .map(improveAjvError)
      .map(error => normalizeAjvError(doc, error))
  }
}

/**
 * @param {JSON} doc
 * @param {Object} ajvError
 * @return {ValidationError}
 */
function normalizeAjvError (doc, ajvError) {
  return {
    path: parseJSONPointerWithArrayIndices(doc, ajvError.dataPath),
    message: ajvError.message
  }
}

/**
 * Improve the error message of a JSON schema error,
 * for example list the available values of an enum.
 *
 * @param {Object} ajvError
 * @return {Object} Returns the error with improved message
 */
function improveAjvError (ajvError) {
  if (ajvError.keyword === 'enum' && Array.isArray(ajvError.schema)) {
    let enums = ajvError.schema
    if (enums) {
      enums = enums.map(value => JSON.stringify(value))

      if (enums.length > 5) {
        const more = ['(' + (enums.length - 5) + ' more...)']
        enums = enums.slice(0, 5)
        enums.push(more)
      }
      ajvError.message = 'should be equal to one of: ' + enums.join(', ')
    }
  }

  if (ajvError.keyword === 'additionalProperties') {
    ajvError.message = 'should NOT have additional property: ' + ajvError.params.additionalProperty
  }

  return ajvError
}
