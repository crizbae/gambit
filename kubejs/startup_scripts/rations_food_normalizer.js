// Normalize selected ration foods to steak-equivalent stats.
// Keep this list in sync with gun:rations/give_random_self item mapping.

const RATION_FOODS = [
  'minecraft:cooked_beef',
  'minecraft:cooked_porkchop',
  'minecraft:cooked_chicken',
  'minecraft:baked_potato'
]

const RATION_HUNGER = 8
const RATION_SATURATION = 0.8

ItemEvents.modification(event => {
  RATION_FOODS.forEach(id => {
    event.modify(id, item => {
      item.foodProperties = food => {
        food.hunger(RATION_HUNGER)
        food.saturation(RATION_SATURATION)
      }
    })
  })
})
