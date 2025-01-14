<template>
  <modal-wrapper variant="wide" @close="close">
    <template #header>
      {{ $t('kpi.goals.edit') }}
    </template>

    <div class="goal-form">
      <div class="goal-form__left">
        <ul>
          <li
            v-for="goal in goals"
            :key="goal.id"
            :class="{ selected: goal.id === activeGoalId }"
            @click="setActiveGoal(goal.id)"
          >
            <a href="#">
              <span>{{ goal.name }}</span>
            </a>
          </li>
        </ul>
        <button class="btn btn--ter btn--icon btn--fw" @click="addGoal(kpi)">
          <i class="icon fa fa-plus" />
          <span>{{ $t('kpi.goals.new') }}</span>
        </button>
      </div>

      <div class="goal-form__right">
        <form-section v-if="activeGoalId">
          <form-component
            v-model="name"
            input-type="input"
            name="name"
            :label="$t('fields.name')"
            type="text"
            rules="required"
          />

          <form-component
            v-model="period"
            input-type="date"
            name="period"
            :label="$t('fields.period')"
            :placeholder="$t('general.selectRange')"
            rules="required"
            :date-picker-config="flatPickrConfig"
          />

          <form-component
            v-model="goalValue"
            input-type="input"
            name="value"
            :label="$t('fields.value')"
            type="number"
            rules="required"
          />
          <span v-if="goalValue" class="display-as">
            {{ $t('general.displayedAs') }} {{ formatKPIValue(kpi, value) }}
          </span>

          <template #actions="{ handleSubmit, submitDisabled }">
            <btn-delete @click="archive($event)" />
            <btn-save
              :label="$t('btn.saveChanges')"
              :disabled="submitDisabled"
              @click="handleSubmit(update)"
            />
          </template>
        </form-section>
      </div>
    </div>

    <template #footer></template>
  </modal-wrapper>
</template>

<script>
import { endOfDay, endOfYear, startOfYear } from 'date-fns';
import { db } from '@/config/firebaseConfig';
import Goal from '@/db/Kpi/Goal';
import { FormSection, BtnDelete, BtnSave } from '@/components/generic/form';
import { toastArchiveAndRevert } from '@/util';
import { formatKPIValue } from '@/util/kpiHelpers';
import ModalWrapper from './ModalWrapper.vue';

export default {
  name: 'ProgressModal',

  components: {
    ModalWrapper,
    FormSection,
    BtnDelete,
    BtnSave,
  },

  props: {
    kpi: {
      type: Object,
      required: true,
    },
  },

  data: () => ({
    flatPickrConfig: {
      altFormat: 'j M Y',
      minDate: null,
      mode: 'range',
      maxDate: null,
      static: true,
    },
    goals: [],
    activeGoalId: null,
    name: null,
    period: null,
    fromDate: null,
    toDate: null,
    value: null,
  }),

  computed: {
    typePercentage() {
      return this.kpi.format === 'percentage';
    },
    goalValue: {
      get() {
        return this.typePercentage ? this.value * 100 : this.value;
      },
      set(val) {
        this.value = this.typePercentage ? val / 100 : val;
      },
    },
  },

  watch: {
    kpi: {
      immediate: true,
      handler() {
        this.bindGoals().then(() => {
          if (!this.activeGoalId && this.goals.length) {
            this.setActiveGoal(this.goals[0].id);
          }
        });
      },
    },
    period() {
      if (this.period && this.period.length === 2) {
        const [fromDate, toDate] = this.period;
        this.fromDate = fromDate;
        this.toDate = endOfDay(toDate);
      } else {
        this.fromDate = null;
        this.toDate = null;
      }
    },
  },

  methods: {
    formatKPIValue,

    close() {
      this.$emit('close');
    },

    async dateSelected(period) {
      const [fromDate, toDate] = period;
      this.fromDate = fromDate;
      this.toDate = endOfDay(toDate);
    },

    async addGoal(kpi) {
      const now = new Date();
      const fromDate = startOfYear(now);
      const toDate = endOfYear(now);

      const goal = await Goal.create(kpi.id, {
        name: this.$t('kpi.goals.new'),
        fromDate,
        toDate,
        value: null,
        archived: false,
      });
      this.fromDate = fromDate;
      this.toDate = toDate;
      await this.setActiveGoal(goal.id);
    },

    async bindGoals() {
      const { ref } = await db.collection('kpis').doc(this.kpi.id).get();
      return this.$bind(
        'goals',
        ref.collection('goals').where('archived', '==', false).orderBy('fromDate', 'desc')
      );
    },

    async setActiveGoal(goalId) {
      const { ref } = await db.collection('kpis').doc(this.kpi.id).get();
      const activeGoal = await ref.collection('goals').doc(goalId).get();
      this.activeGoalId = goalId;
      this.name = activeGoal.get('name');
      const fromDate = activeGoal.get('fromDate');
      const toDate = activeGoal.get('toDate');
      if (fromDate && toDate) {
        this.period = [fromDate.toDate(), toDate.toDate()];
        [this.fromDate, this.toDate] = this.period;
      }
      this.value = activeGoal.get('value');
    },

    async clearActiveGoal() {
      this.activeGoalId = null;
      this.activeGoal = null;
      this.name = null;
      this.period = null;
      this.fromDate = null;
      this.toDate = null;
      this.value = null;
    },

    async update() {
      try {
        await Goal.update(this.kpi.id, this.activeGoalId, {
          name: this.name,
          fromDate: this.fromDate,
          toDate: this.toDate,
          value: this.value,
        });

        this.$toasted.show(this.$t('toaster.savedChanges'));
      } catch (error) {
        console.log(error);
        this.$toasted.error(this.$t('toaster.error.save'));
      }
    },

    async archive(event) {
      event.preventDefault();

      try {
        await Goal.archive(this.kpi.id, this.activeGoalId);
        const restoreCallback = this.restore.bind(this, this.kpi.id, this.activeGoalId);
        toastArchiveAndRevert({
          name: this.name || this.$t('kpi.goals.the'),
          callback: restoreCallback,
        });
      } catch {
        this.$toasted.error(
          this.$t('toaster.error.archive', {
            document: this.name || this.$t('kpi.goals.the'),
          })
        );
      }
      if (this.goals.length) {
        await this.setActiveGoal(this.goals[0].id);
      } else {
        await this.clearActiveGoal();
      }
    },

    async restore(kpiId, goalId) {
      try {
        await Goal.restore(kpiId, goalId);
        this.$toasted.show(this.$t('toaster.restored'));
      } catch {
        this.$toasted.error(
          this.$t('toaster.error.restore', { document: this.$t('kpi.goals.the') })
        );
      }
      await this.setActiveGoal(goalId);
    },
  },
};
</script>

<style lang="scss" scoped>
@use '@/styles/typography';

::v-deep .modal {
  overflow-y: visible;
}

.goal-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;

  @media screen and (min-width: bp(s)) {
    flex-direction: row;
  }

  .display-as {
    padding-bottom: 0.5rem;
    color: var(--color-grey-500);
    font-weight: 500;
    font-size: typography.$font-size-1;
  }

  &__left {
    display: flex;
    flex-direction: column;
    flex-grow: 1;
    height: 100%;
    border: 1px solid var(--color-grayscale-10);

    @media screen and (min-width: bp(s)) {
      margin-right: 1.5rem;
    }

    ul {
      height: 19rem;
      overflow-y: scroll;
    }

    li {
      display: block;
      padding: 0.5rem 0.75rem;
      color: var(--color-text);
      text-decoration: none;
      border-bottom: 1px solid var(--color-grayscale-10);
      cursor: pointer;

      &.selected {
        color: var(--color-text);
        font-weight: 500;
        background: var(--color-gray-light);
      }

      &.active {
        color: var(--color-text-secondary);
        font-weight: 500;
        background: var(--color-primary);
      }
    }

    a {
      color: var(--color-text);
      text-decoration: none;
    }

    button {
      margin-top: auto;
      border-top: 1px solid var(--color-grayscale-10);
    }
  }

  &__right {
    display: flex;
    flex-basis: 45%;
    flex-direction: column;
  }

  ::v-deep form span:first-child .form-group {
    margin-top: 0;
  }

  .button-row {
    justify-content: flex-end;
    margin-top: 2rem;
  }
}
</style>
