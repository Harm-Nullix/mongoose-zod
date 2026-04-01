<template>
  <UContainer class="py-12 max-w-4xl">
    <div class="mb-8">
      <UButton
        to="/"
        icon="i-heroicons-arrow-left"
        variant="ghost"
        color="neutral"
        label="Back to Feed"
      />
    </div>

    <div v-if="pending" class="space-y-4">
      <USkeleton class="h-12 w-3/4" />
      <USkeleton class="h-4 w-1/4" />
      <USkeleton class="h-64 w-full" />
    </div>

    <div v-else-if="error || !post" class="text-center py-20">
      <UIcon name="i-heroicons-exclamation-triangle" class="w-16 h-16 text-red-500 mx-auto mb-4" />
      <h2 class="text-2xl font-bold">Post not found</h2>
      <p class="text-gray-500 mt-2">The post you are looking for does not exist or has been deleted.</p>
    </div>

    <div v-else class="space-y-8">
      <UCard>
        <template #header>
          <div class="flex justify-between items-start">
            <div>
              <h1 class="text-3xl font-extrabold text-gray-900 dark:text-white">
                {{ post.title }}
              </h1>
              <div class="flex items-center gap-2 mt-2 text-gray-500">
                <UAvatar
                  :alt="post.author?.username"
                  size="xs"
                  :ui="{ root: 'rounded-full' }"
                />
                <span class="font-medium text-primary">@{{ post.author?.username || 'unknown' }}</span>
                <span>•</span>
                <span>{{ post.createdAt ? new Date(post.createdAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }) : 'recently' }}</span>
              </div>
            </div>
            <div class="flex gap-2">
              <UButton
                icon="i-heroicons-pencil"
                color="primary"
                variant="soft"
                label="Edit"
                @click="isEditing = true"
              />
              <UButton
                icon="i-heroicons-trash"
                color="error"
                variant="soft"
                label="Delete"
                @click="onDelete"
              />
            </div>
          </div>
        </template>

        <div class="prose dark:prose-invert max-w-none">
          <p class="text-lg whitespace-pre-wrap leading-relaxed">
            {{ post.content }}
          </p>
        </div>

        <template v-if="post.mentions && post.mentions.length > 0" #footer>
          <div class="flex items-center gap-3">
            <span class="text-sm font-semibold text-gray-400 uppercase tracking-wider">Tagged Users:</span>
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

      <!-- Edit Modal -->
      <UModal v-model="isEditing">
        <UCard :ui="{ body: 'py-4' }">
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">
                Edit Post
              </h3>
              <UButton
                color="neutral"
                variant="ghost"
                icon="i-heroicons-x-mark-20-solid"
                class="-my-1"
                @click="isEditing = false"
              />
            </div>
          </template>

          <UForm :schema="PostInputSchema.partial()" :state="editState" class="space-y-4 py-4" @submit="onUpdate">
            <UFormField label="Title" name="title">
              <UInput v-model="editState.title" icon="i-heroicons-type-specimen" />
            </UFormField>

            <UFormField label="Content" name="content">
              <UTextarea v-model="editState.content" :rows="6" autoresize />
            </UFormField>

            <UFormField label="Mentions" name="mentions">
              <USelectMenu
                v-model="editState.mentions"
                :items="users"
                placeholder="Tag users..."
                multiple
                value-key="_id"
                label-key="username"
                icon="i-heroicons-at-symbol"
              />
            </UFormField>

            <div class="flex justify-end gap-3 mt-6">
              <UButton
                label="Cancel"
                color="neutral"
                variant="ghost"
                @click="isEditing = false"
              />
              <UButton
                type="submit"
                label="Save Changes"
                color="primary"
                :loading="updating"
              />
            </div>
          </UForm>
        </UCard>
      </UModal>
    </div>
  </UContainer>
</template>

<script setup lang="ts">
import {PostInputSchema, type PopulatedPost, type User} from '#shared/schemas';
import type {FormSubmitEvent} from '@nuxt/ui';

const route = useRoute();
const router = useRouter();
const id = route.params.id;

const {data: post, pending, error, refresh} = await useFetch<PopulatedPost>(`/api/posts/${id}`);

const isEditing = ref(false);
const updating = ref(false);

const editState = reactive({
  title: post.value?.title || '',
  content: post.value?.content || '',
  mentions: post.value?.mentions?.map(m => String(m._id)) || [] as string[],
});

// Sync editState when post data loads
watch(post, (newPost) => {
  if (newPost) {
    editState.title = newPost.title;
    editState.content = newPost.content;
    editState.mentions = newPost.mentions?.map(m => String(m._id)) || [];
  }
}, {immediate: true});

// Fetch users for mentions
const {data: users} = await useFetch<User[]>('/api/users', {
  default: () => [],
});

const onUpdate = async (event: FormSubmitEvent<any>) => {
  updating.value = true;
  try {
    await $fetch(`/api/posts/${id}`, {
      method: 'PATCH',
      body: event.data,
    });
    await refresh();
    isEditing.value = false;
  } catch (err) {
    console.error(err);
    alert('Failed to update post');
  } finally {
    updating.value = false;
  }
};

const onDelete = async () => {
  if (!confirm('Are you sure you want to delete this post?')) return;

  try {
    await $fetch(`/api/posts/${id}`, {
      method: 'DELETE',
    });
    router.push('/');
  } catch (err) {
    console.error(err);
    alert('Failed to delete post');
  }
};
</script>
