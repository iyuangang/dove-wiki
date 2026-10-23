import { expect, it } from 'vitest'
import contract from '../src/data/rating-contract.json'
import { seedVariation } from './rating-variation.mjs'
it('uses paired seeds and flags observed boundary crossings, without counting failed trials',()=>{
  const object={rounds:{single:[{seed:1,damage:10,duration:1},{seed:2,damage:20,duration:1},{seed:3,error:'failed'}]}}
  const result=seedVariation(object,{single:{reference:10}},contract)
  expect(result.single).toMatchObject({n:2,min:10,max:20,crossesGrade:true,sd:5})
})
