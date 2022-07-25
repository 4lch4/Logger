import * as chai from 'chai'
import * as mocha from 'mocha'
import { Level } from '../dist/interfaces/index.js'
import {
  DefaultColors,
  DefaultDayJSFormats,
  DefaultLogFormat
} from '../dist/lib/defaults.js'
import { COLOR_MAP } from './TestData'

const expect = chai.expect
const describe = mocha.describe

describe('Defaults should export the 3 objects of import', () => {
  it('Should export the DefaultColors object', () => {
    expect(DefaultColors).to.be.an('object')
  })

  it('Should export the DefaultDayJSFormats object', () => {
    expect(DefaultDayJSFormats).to.be.an('object')
  })

  it('Should export the DefaultLogFormat object', () => {
    expect(DefaultLogFormat).to.be.a('string')
  })
})

describe('The DefaultDayJSFormats should export the needed properties', () => {
  it('should export a prettyFormat string', () => {
    expect(DefaultDayJSFormats.prettyFormat).to.be.a('string')
  })

  it('should export a utcMillisecondsFormat string', () => {
    expect(DefaultDayJSFormats.utcMillisecondsFormat).to.be.a('string')
  })
})

describe('The DefaultLogFormat value should be plaintext', () => {
  expect(DefaultLogFormat).to.equal('plaintext')
})

describe('The DefaultColors object should contain a color for each log level', () => {
  it('should have a color for the debug level which matches our colorMap', () => {
    expect(DefaultColors[Level.debug]).to.be.a('string')
    expect(DefaultColors[Level.debug]).to.equal(COLOR_MAP[Level.debug])
  })

  it('should have a color for the error log level which matches our colorMap', () => {
    expect(DefaultColors[Level.error]).to.be.a('string')
    expect(DefaultColors[Level.error]).to.equal(COLOR_MAP[Level.error])
  })

  it('should have a color for the info log level which matches our colorMap', () => {
    expect(DefaultColors[Level.info]).to.be.a('string')
    expect(DefaultColors[Level.info]).to.equal(COLOR_MAP[Level.info])
  })

  it('should have a color for the success log level which matches our colorMap', () => {
    expect(DefaultColors[Level.success]).to.be.a('string')
    expect(DefaultColors[Level.success]).to.equal(COLOR_MAP[Level.success])
  })

  it('should have a color for the warn log level which matches our colorMap', () => {
    expect(DefaultColors[Level.warn]).to.be.a('string')
    expect(DefaultColors[Level.warn]).to.equal(COLOR_MAP[Level.warn])
  })
})
