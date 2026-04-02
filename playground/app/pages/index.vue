<template>
  <UContainer class="py-12 max-w-6xl">
    <header class="mb-12 text-center">
      <div class="flex items-center justify-center gap-3 mb-4">
        <UIcon name="i-heroicons-bolt-20-solid" class="w-10 h-10 text-primary" />
        <h1
          class="text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white sm:text-5xl"
        >
          @nullix/zod-mongoose
        </h1>
      </div>
      <p class="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
        The ultimate bridge between <span class="text-primary font-semibold">Zod v4</span> and
        <span class="text-primary font-semibold">Mongoose</span>. Define once, validate everywhere.
      </p>
      <div class="mt-6 flex justify-center gap-4">
        <UBadge color="primary" variant="soft" size="lg">Nuxt 4 Ready</UBadge>
        <UBadge color="neutral" variant="soft" size="lg">TypeScript Native</UBadge>
        <UButton to="/showcase" size="sm" variant="link" icon="i-heroicons-beaker"
          >View Complex Schemas</UButton
        >
      </div>
    </header>

    <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
      <!-- Sidebar / Create Post -->
      <aside class="lg:col-span-5">
        <UCard class="sticky top-8">
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-pencil-square" class="w-5 h-5 text-primary" />
              <h2 class="text-xl font-bold">Create New Post</h2>
            </div>
            <p class="text-sm text-gray-500 mt-1">Share your thoughts with the community.</p>
          </template>

          <UForm :schema="PostInputSchema" :state="state.form" class="space-y-6" @submit="onSubmit">
            <UFormField label="Author" name="author" help="Who is writing this post?">
              <USelectMenu
                v-model="state.form.author"
                :items="users"
                placeholder="Select an author"
                value-key="_id"
                label-key="username"
                class="w-full"
                icon="i-heroicons-user"
              >
              </USelectMenu>
            </UFormField>

            <UFormField label="Title" name="title">
              <UInput
                v-model="state.form.title"
                placeholder="Enter a catchy title..."
                class="w-full"
                icon="i-heroicons-h1"
              />
            </UFormField>

            <UFormField label="Content" name="content">
              <UTextarea
                v-model="state.form.content"
                placeholder="What's on your mind?"
                class="w-full"
                :rows="5"
                autoresize
              />
            </UFormField>

            <UFormField label="Mentions" name="mentions" help="Tag other users in your post.">
              <USelectMenu
                v-model="state.form.mentions"
                :items="users"
                placeholder="Tag users..."
                multiple
                value-key="_id"
                label-key="username"
                class="w-full"
                icon="i-heroicons-at-symbol"
              >
              </USelectMenu>
            </UFormField>

            <UButton
              type="submit"
              :loading="loading"
              color="primary"
              size="lg"
              block
              icon="i-heroicons-paper-airplane"
            >
              Publish Post
            </UButton>
          </UForm>
        </UCard>
      </aside>

      <!-- Main Feed -->
      <main class="lg:col-span-7">
        <div class="flex items-center justify-between mb-6">
          <div class="flex items-center gap-2">
            <UIcon name="i-heroicons-rss" class="w-6 h-6 text-primary" />
            <h2 class="text-2xl font-bold">Community Feed</h2>
          </div>
          <UButton
            variant="ghost"
            color="neutral"
            icon="i-heroicons-arrow-path"
            :loading="pending"
            label="Refresh Feed"
            @click="() => refresh()"
          />
        </div>

        <div v-if="pending && !posts.length" class="space-y-4">
          <USkeleton v-for="i in 3" :key="i" class="h-48 w-full" />
        </div>

        <div
          v-else-if="!posts || posts.length === 0"
          class="text-center py-20 bg-gray-50 dark:bg-gray-900/50 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-800"
        >
          <UIcon
            name="i-heroicons-chat-bubble-left-right"
            class="w-12 h-12 text-gray-400 mx-auto mb-4"
          />
          <h3 class="text-lg font-medium text-gray-900 dark:text-white">No posts yet</h3>
          <p class="text-gray-500 mt-1">Be the first one to start the conversation!</p>
        </div>

        <div v-else class="space-y-6">
          <TransitionGroup name="list" tag="div" class="space-y-6">
            <UCard
              v-for="post in posts"
              :key="String(post._id)"
              class="transition-all hover:ring-2 hover:ring-primary/50 cursor-pointer"
              @click="router.push(`/posts/${post._id}`)"
            >
              <template #header>
                <div class="flex justify-between items-start">
                  <div>
                    <h3 class="font-bold text-xl text-gray-900 dark:text-white">
                      {{ post.title }}
                    </h3>
                    <div class="flex items-center gap-2 mt-1 text-sm text-gray-500">
                      <UAvatar
                        :alt="post.author?.username"
                        size="xs"
                        :ui="{root: 'rounded-full'}"
                      />
                      <span class="font-medium text-primary"
                        >@{{ post.author?.username || 'unknown' }}</span
                      >
                      <span>•</span>
                      <span>{{
                        post.createdAt
                          ? new Date(post.createdAt).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })
                          : 'recently'
                      }}</span>
                    </div>
                  </div>
                </div>
              </template>

              <p class="text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                {{ post.content }}
              </p>

              <template v-if="post.mentions && post.mentions.length > 0" #footer>
                <div class="flex items-center gap-2">
                  <span class="text-xs font-semibold text-gray-400 uppercase tracking-wider"
                    >Mentions:</span
                  >
                  <div class="flex flex-wrap gap-2">
                    <UBadge
                      v-for="m in post.mentions"
                      :key="String(m._id)"
                      variant="subtle"
                      color="neutral"
                      class="rounded-full"
                    >
                      @{{ m?.username || 'unknown' }}
                    </UBadge>
                  </div>
                </div>
              </template>
            </UCard>
          </TransitionGroup>
        </div>
      </main>
    </div>
  </UContainer>
</template>

<style scoped>
.list-enter-active,
.list-leave-active {
  transition: all 0.5s ease;
}
.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateY(30px);
}
</style>

<script setup lang="ts">
import {PostInputSchema, type PopulatedPost, type User} from '#shared/schemas';
import type {FormSubmitEvent} from '@nuxt/ui';

const router = useRouter();

const state = reactive({
  form: {
    title: '',
    content: '',
    author: undefined as string | undefined,
    mentions: [] as string[],
  },
});

const loading = ref(false);

// Fetch users
const {data: users} = await useFetch<User[]>('/api/users', {
  default: () => [],
});

// Watch users to set default author if not set
watch(
  users,
  (newUsers) => {
    if (newUsers && newUsers.length > 0 && !state.form.author) {
      const firstUser = newUsers[0];
      if (firstUser && firstUser._id) {
        state.form.author = String(firstUser._id);
      }
    }
  },
  {immediate: true},
);

// Fetch posts
const {
  data: posts,
  pending,
  refresh,
} = await useFetch<PopulatedPost[]>('/api/posts', {
  default: () => [],
});

const onSubmit = async (event: FormSubmitEvent<any>) => {
  loading.value = true;
  try {
    await $fetch('/api/posts', {
      method: 'POST',
      body: event.data,
    });

    // Reset state (keep same author)
    state.form.title = '';
    state.form.content = '';
    state.form.mentions = [];

    await refresh();
  } catch (err) {
    console.error(err);
    alert('Failed to create post');
  } finally {
    loading.value = false;
  }
};
</script>
