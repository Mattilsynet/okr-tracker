<template>
  <div v-if="user" class="modal__main--flex">
    <div class="column">
      <h2 class="widget__title title-2">{{ $t('user.profile') }}</h2>

      <user-profile-form :user="user" :loading="loading" @save="save" />

      <hr class="pkt-hr" />

      <h3 class="widget__title title-2">{{ $t('user.myProducts') }}</h3>

      <ul v-if="products.length > 0">
        <li v-for="product in products" :key="product.id">
          <div class="profileModal__info">
            <h2 class="title-2">{{ product.department.name }}</h2>
            <div>{{ product.name }}</div>
          </div>
        </li>
      </ul>

      <hr class="pkt-hr" />

      <h3 class="widget__title title-2">{{ $t('user.access') }}</h3>

      <div v-if="user.superAdmin" class="profileModal__info">
        <h2 class="title-2">{{ $t('user.superAdmin') }}</h2>
        <div>{{ $t('user.hasSuperAdmin') }}</div>
      </div>

      <div v-if="user.admin && user.admin.length > 0" class="profileModal__info">
        <h2 class="title-2">{{ $t('user.admin') }}</h2>
        <div>{{ $t('user.hasAdmin') }}</div>
      </div>

      <hr class="pkt-hr" />

      <h3 class="widget__title title-2">{{ $t('general.administration') }}</h3>

      <div class="sidebar__group sidebar__bottom button-col">
        <router-link
          v-if="user.admin"
          :to="{ name: 'Admin' }"
          class="btn btn--ter button-link"
        >
          <span>{{ $t('general.admin') }}</span>
        </router-link>
        <router-link :to="{ name: 'Help' }" class="btn btn--ter button-link">
          <span>{{ $t('general.help') }}</span>
        </router-link>
        <router-link :to="{ name: 'Api' }" class="btn btn--ter button-link">
          <span>{{ $t('general.api') }}</span>
        </router-link>
        <button class="btn btn--ter btn--icon btn--icon-pri button-link" @click="signOut">
          <span class="">{{ $t('general.signOut') }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
<script>
import { mapActions } from 'vuex';
import { db, auth } from '@/config/firebaseConfig';
import User from '@/db/User';
import UserProfileForm from '@/components/forms/UserProfileForm.vue';

export default {
  name: 'UserProfileMenu',

  components: {
    UserProfileForm,
  },

  props: {
    myProfile: {
      type: Boolean,
      required: false,
      default: false,
    },

    id: {
      type: String,
      required: true,
    },
  },

  data: () => ({
    user: null,
    products: [],
    audit: [],
    image: null,
    loading: false,
  }),

  computed: {
    me() {
      return this.$store.state.user?.id === this.user?.id;
    },
  },

  watch: {
    id: {
      immediate: true,
      async handler(id) {
        const userRef = await db.doc(`users/${id}`);
        const productsRef = await db
          .collection('products')
          .where('team', 'array-contains', userRef)
          .where('archived', '==', false);
        const auditRef = await db
          .collection('audit')
          .where('user', '==', userRef)
          .orderBy('timestamp', 'desc')
          .limit(10);

        this.$bind('user', userRef);
        this.$bind('products', productsRef, { maxRefDepth: 1 });
        this.$bind('audit', auditRef, { maxRefDepth: 1 });
      },
    },
  },

  methods: {
    ...mapActions(['reset_state']),

    async save(user) {
      this.loading = true;
      try {
        await User.update(user);
        await this.$router.go();
        this.$toasted.show(this.$t('toaster.savedChanges'));
      } catch (error) {
        console.error(error);
        this.$toasted.error(this.$t('toaster.error.save'));
      }

      this.loading = false;
    },

    async signOut() {
      await auth.signOut();
      await this.reset_state();
    },
  },
};
</script>

<style lang="scss" scoped>
@use '@/styles/typography';

.profileModal__label {
  display: inline-block;
  margin: 0.8rem 0 0.5rem 0;
  color: var(--color-grayscale-30);
  font-weight: 500;
  font-size: typography.$font-size-2;
  letter-spacing: -0.03rem;
}

.profileModal__input {
  width: 100%;
  padding: 0.7rem;
  background: var(--color-gray-light);
  border-radius: 0;
}

.profileModal__required {
  color: var(--color-red);
}

.profileModal__info {
  padding-top: 0.6rem;
  padding-bottom: 0.6rem;
}

.modal__main--flex {
  display: flex;
  flex-basis: 100%;
  flex-direction: column;
  width: 100%;
  /* max-width: 600px; */
  max-height: calc(100vh - 8rem);
  padding: 0 0 0 1.5rem;
  overflow: auto;
  color: var(--color-text);
  background: white;
  border-radius: 1px;
  box-shadow: 0 0.25rem 0.45rem rgba(black, 0.5);

  @media screen and (min-width: bp(s)) {
    flex-direction: row;
  }

  scrollbar-width: none; /* Hide scrollbar styles Firefox */
  -webkit-overflow-scrolling: touch;

  &::-webkit-scrollbar {
    display: flex;
  }
}

.column {
  display: flex;
  flex-direction: column;
  flex-grow: 2;
  padding: 0 1.5rem 0 0;
}

.profileModal__save-button {
  align-self: end;
  margin-top: 1rem;
}

.product {
  margin-bottom: 1rem;
  padding: 0.75rem 0.75rem 0.6rem 0.75rem;
  color: var(--color-text);
  font-weight: 500;
  border: 1px solid black;
  border-radius: 0px;
}

.button-link {
  padding: 0.75rem 0 0 0;
  color: var(--color-text);
  background: transparent;
  border-style: none;

  &:hover {
    text-decoration: underline;
  }
}

.desktop-only {
  @media screen and (min-width: bp(m)) {
    display: none;
  }
}
</style>
