<template>
  <UContainer class="py-12 max-w-4xl">
    <header class="mb-12 text-center">
      <h1 class="text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white sm:text-5xl mb-4">
        Complex Schemas Showcase
      </h1>
      <p class="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
        Testing advanced Zod-to-Mongoose mappings including Composite IDs, Tuples, Records, and Buffers.
      </p>
      <div class="mt-6">
        <UButton to="/" icon="i-heroicons-arrow-left" variant="ghost">Back to Feed</UButton>
      </div>
    </header>

    <div class="space-y-12">
      <!-- User Section (Unique, Lowercase, Intersection) -->
      <section>
        <div class="flex items-center gap-2 mb-4">
          <UIcon name="i-heroicons-user-group" class="w-6 h-6 text-primary" />
          <h2 class="text-2xl font-bold">User Enhancements</h2>
        </div>
        <UCard>
          <template #header>
            <div class="flex justify-between items-center">
              <span class="font-semibold">Constraints & Intersections</span>
              <UBadge color="primary" variant="soft">Unique, Lowercase, Intersection</UBadge>
            </div>
          </template>
          <div class="space-y-4">
            <p class="text-sm text-gray-500">
              Usernames and emails are now <code>unique</code> and <code>lowercase</code> at the database level.
              The <code>profile</code> field is an <code>intersection</code> of two Zod objects.
            </p>
            <div class="bg-gray-900 rounded-lg p-4 overflow-x-auto">
              <pre class="text-xs text-green-400"><code>{{ JSON.stringify(users?.[0], null, 2) }}</code></pre>
            </div>
          </div>
        </UCard>
      </section>

      <!-- Settings Section (Tuple, Record, Map) -->
      <section>
        <div class="flex items-center gap-2 mb-4">
          <UIcon name="i-heroicons-cog-8-tooth" class="w-6 h-6 text-primary" />
          <h2 class="text-2xl font-bold">Collections & Tuples</h2>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <UCard>
            <template #header><span class="font-semibold">Tuple (Location)</span></template>
            <p class="text-sm mb-4">Mapped to a fixed-size array in Mongoose.</p>
            <UBadge v-if="settings?.location" variant="outline" color="neutral">
              [ {{ settings.location[0] }}, {{ settings.location[1] }} ]
            </UBadge>
            <span v-else class="text-gray-400 italic text-sm">No location set</span>
          </UCard>

          <UCard>
            <template #header><span class="font-semibold">Record/Map (Preferences)</span></template>
            <p class="text-sm mb-4">Mapped to <code>Map</code> in Mongoose.</p>
            <div class="space-y-2">
              <div v-for="(val, key) in settings?.preferences" :key="key" class="flex justify-between text-sm">
                <span class="font-medium">{{ key }}:</span>
                <span class="text-gray-600">{{ val }}</span>
              </div>
            </div>
          </UCard>
        </div>
      </section>

      <!-- Task Section (Composite ID) -->
      <section>
        <div class="flex items-center gap-2 mb-4">
          <UIcon name="i-heroicons-clipboard-document-list" class="w-6 h-6 text-primary" />
          <h2 class="text-2xl font-bold">Composite Keys</h2>
        </div>
        <UCard>
          <template #header>
            <div class="flex justify-between items-center">
              <span class="font-semibold">Task with Object ID</span>
              <UBadge color="neutral" variant="soft">_id: { orgId, taskId }</UBadge>
            </div>
          </template>
          <div class="space-y-4">
            <p class="text-sm">This model uses an object as its primary key <code>_id</code>.</p>
            <div v-for="task in tasks" :key="JSON.stringify(task._id)" class="p-3 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <div>
                <div class="font-bold">{{ task.title }}</div>
                <div class="text-xs text-gray-500">ID: {{ JSON.stringify(task._id) }}</div>
              </div>
              <UBadge color="primary">Task #{{ (task._id as any).taskId }}</UBadge>
            </div>
            <UButton size="sm" variant="soft" icon="i-heroicons-plus" @click="createTask">Create Test Task</UButton>
          </div>
        </UCard>
      </section>

      <!-- Activity Section (Discriminated Union) -->
      <section>
        <div class="flex items-center gap-2 mb-4">
          <UIcon name="i-heroicons-bolt" class="w-6 h-6 text-primary" />
          <h2 class="text-2xl font-bold">Discriminated Union</h2>
        </div>
        <UCard>
          <template #header><span class="font-semibold">Activity Log</span></template>
          <div class="space-y-4">
            <p class="text-sm">Mapped to <code>Mixed</code> by default, but typed with Zod.</p>
            <div class="space-y-2">
              <div v-for="(activity, i) in activities" :key="i" class="flex items-center gap-3 p-2 bg-gray-50 dark:bg-gray-800 rounded text-sm">
                <UBadge :color="activity.type === 'login' ? 'success' : 'info'" size="xs">{{ activity.type }}</UBadge>
                <span class="text-gray-500">{{ new Date(activity.timestamp).toLocaleTimeString() }}</span>
                <span v-if="activity.type === 'post_create'" class="truncate text-xs">Post: {{ (activity as any).postId }}</span>
              </div>
              <UButton size="sm" variant="soft" icon="i-heroicons-plus" @click="logActivity">Log Random Activity</UButton>
            </div>
          </div>
        </UCard>
      </section>

      <!-- Asset Section (Buffer, Literal) -->
      <section>
        <div class="flex items-center gap-2 mb-4">
          <UIcon name="i-heroicons-document" class="w-6 h-6 text-primary" />
          <h2 class="text-2xl font-bold">Buffers & Literals</h2>
        </div>
        <UCard>
          <template #header><span class="font-semibold">Binary Assets</span></template>
          <div class="space-y-4">
            <p class="text-sm">Handling <code>Buffer</code> and Zod <code>literal</code> types.</p>
            <div v-for="asset in assets" :key="asset._id?.toString()" class="p-3 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <div>
                <div class="font-bold">{{ asset.name }}</div>
                <div class="text-xs text-gray-500">Type: {{ asset.type }} | Tags: {{ asset.tags.join(', ') }}</div>
              </div>
              <UBadge color="neutral" variant="outline" size="sm">Buffer Data</UBadge>
            </div>
            <UButton size="sm" variant="soft" icon="i-heroicons-plus" @click="createAsset">Create Sample Asset</UButton>
          </div>
        </UCard>
      </section>
    </div>
  </UContainer>
</template>

<script setup lang="ts">
import type { User, Settings, Task, Activity, Asset } from '#shared/schemas';

const { data: users } = await useFetch<User[]>('/api/showcase/users');
const { data: settings } = await useFetch<Settings>('/api/showcase/settings');
const { data: tasks, refresh: refreshTasks } = await useFetch<Task[]>('/api/showcase/tasks');
const { data: activities, refresh: refreshActivities } = await useFetch<Activity[]>('/api/showcase/activities');
const { data: assets, refresh: refreshAssets } = await useFetch<Asset[]>('/api/showcase/assets');

const createTask = async () => {
  await $fetch('/api/showcase/tasks', {
    method: 'POST',
    body: {
      title: 'New Composite Task ' + Math.floor(Math.random() * 1000),
      description: 'Test description for composite ID task',
      orgId: 'org_' + Math.floor(Math.random() * 100),
      taskId: Math.floor(Math.random() * 10000)
    }
  });
  await refreshTasks();
};

const createAsset = async () => {
  await $fetch('/api/showcase/assets', {
    method: 'POST',
    body: {
      name: 'Test Asset ' + Math.floor(Math.random() * 1000),
      type: 'text',
      data: 'Some buffer data ' + Date.now(),
      tags: ['test', 'showcase']
    }
  });
  await refreshAssets();
};

const logActivity = async () => {
  const types = ['login', 'post_create'] as const;
  const type = types[Math.floor(Math.random() * types.length)];
  
  await $fetch('/api/showcase/activities', {
    method: 'POST',
    body: {
      type,
      timestamp: new Date(),
      ...(type === 'post_create' ? { postId: '65f1a2b3c4d5e6f7a8b9c0d1' } : {})
    }
  });
  await refreshActivities();
};
</script>
