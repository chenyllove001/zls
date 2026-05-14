Component({
  properties: {
    task: {
      type: Object,
      value: {}
    },
    status: {
      type: String,
      value: 'pending'
    }
  },

  methods: {
    onComplete() {
      this.triggerEvent('complete', {
        taskId: this.properties.task._id
      })
    }
  }
})
