import { foodsRepository } from "../repository/foods.repository";

export const foodsService = {
  async listFoods() {
    return foodsRepository.findAll();
  },
};
