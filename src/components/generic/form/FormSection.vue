<template>
  <validation-observer v-slot="{ errors, valid, validated }" ref="form" tag="form">
    <slot />

    <pkt-alert v-if="validated && !valid" skin="error" class="form-errors">
      <template #title>{{ $t('general.formErrors') }}</template>
      <template #content>
        <ul v-if="errors" class="form-errors__list">
          <template v-for="(fieldErrors, fieldName) in errors">
            <li v-if="fieldErrors.length" :key="fieldName">
              <span>{{ $t('fields.' + fieldName) }}</span>
              <span>{{ fieldErrors[0] }}</span>
            </li>
          </template>
        </ul>
      </template>
    </pkt-alert>

    <div class="button-row">
      <slot
        name="actions"
        :handle-submit="submitAndReset"
        :submit-disabled="validated && !valid"
        :errors="errors"
      />
    </div>
  </validation-observer>
</template>

<script>
export default {
  name: 'FormSection',

  components: {
    PktAlert: () => import('@oslokommune/punkt-vue2').then(({ PktAlert }) => PktAlert),
  },

  methods: {
    async submitAndReset(handler) {
      const { validate } = this.$refs.form;
      const isValid = await validate();

      if (!isValid || !handler) {
        return undefined;
      }

      const result = handler();
      this.$refs.form.reset();
      return result;
    },
  },
};
</script>
