import * as chai from 'chai'
import * as mocha from 'mocha'
import { Logger, logger } from '../src'

const expect = chai.expect
const describe = mocha.describe

describe('Exports logger class/object', () => {
  it('Should export logger class', () => {
    expect(Logger).to.be.a('function')
  })

  it('Should export logger object', () => {
    expect(logger).to.be.an('object')
  })
})

describe('Logger exports the standard methods', () => {
  it('Should export an info method', () => {
    expect(logger.info).to.be.a('function')
  })

  it('Should export a warn method', () => {
    expect(logger.warn).to.be.a('function')
  })

  it('Should export an error method', () => {
    expect(logger.error).to.be.a('function')
  })

  it('Should export a debug method', () => {
    expect(logger.debug).to.be.a('function')
  })

  it('Should export a success method', () => {
    expect(logger.success).to.be.a('function')
  })

  it('Should export a log method', () => {
    expect(logger.log).to.be.a('function')
  })
})
