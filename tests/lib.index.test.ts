import * as chai from 'chai'
import * as mocha from 'mocha'
import {
  DefaultColors,
  DefaultDayJSFormats,
  DefaultLogFormat,
  Formatter
} from '../src/lib'

const expect = chai.expect
const describe = mocha.describe

describe('lib/index.ts should export the defaults and Formatter values', () => {
  it('should export a DefaultColors object', () => {
    expect(DefaultColors).to.be.an('object')
  })

  it('should export a DefaultDayJSFormats object', () => {
    expect(DefaultDayJSFormats).to.be.an('object')
  })

  it('should export a DefaultLogFormat string', () => {
    expect(DefaultLogFormat).to.be.a('string')
  })

  it('should export a Formatter function/class', () => {
    expect(Formatter).to.be.a('function')
  })
})
