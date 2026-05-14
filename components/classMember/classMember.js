const petCalculator = require('../../utils/petCalculator.js')

Component({
  properties: {
    member: {
      type: Object,
      value: {}
    },
    petInfo: {
      type: Object,
      value: null
    },
    rank: {
      type: Number,
      value: 0
    }
  },

  data: {
    defaultAvatar: '/assets/images/default-avatar.png',
    rankDisplay: '',
    nextLevelExp: 0
  },

  attached() {
    const rank = this.data.rank
    this.setData({
      rankDisplay: rank + '.',
      nextLevelExp: this.data.petInfo ? petCalculator.getNextLevelExp(this.data.petInfo.level) : 0
    })
  }
})
